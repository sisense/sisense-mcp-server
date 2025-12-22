import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { ChartWidgetProps, SisenseContextProviderProps } from '@sisense/sdk-ui';
import { CustomSuperJSON } from '@sisense/sdk-ui/analytics-composer/node';
import { toKebabCase } from '@/utils/string-utils';

// Get the project root directory reliably
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Go up 3 levels: widget-renderer -> utils -> src -> project root
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

export interface WidgetRenderConfig {
  widgetProps: ChartWidgetProps;
  sisenseContextProviderProps: SisenseContextProviderProps;
  width?: number;
  height?: number;
  outputName?: string;
}

export interface WidgetRenderResult {
  pngPath: string;
  success: boolean;
  error?: string;
  timings?: {
    renderMs: number;
    totalMs: number;
  };
}

/**
 * Renders a widget using Playwright Component Testing by:
 * 1. Writing widget config to a temporary JSON file
 * 2. Generating custom screenshot path in __screenshots__/
 * 3. Running Playwright CT with config and screenshot paths as env vars
 * 4. Returning the screenshot path and timing information
 */
export async function renderChartWidgetWithPlaywrightCT(
  config: WidgetRenderConfig,
): Promise<WidgetRenderResult> {
  const startTime = Date.now();
  const width = config.width || 1000;
  const height = config.height || 600;

  // Create a temporary config file
  const testId = randomBytes(8).toString('hex');
  const testDir = join(tmpdir(), `widget-ct-${testId}`);
  mkdirSync(testDir, { recursive: true });

  const configPath = join(testDir, 'widget-config.json');

  // Write config to temp file using CustomSuperJSON to preserve CSDK object methods
  const configData = {
    widgetProps: config.widgetProps,
    sisenseContextProviderProps: config.sisenseContextProviderProps,
    width,
    height,
    outputName: config.outputName,
  };

  const serializedConfig = CustomSuperJSON.stringify(configData);
  writeFileSync(configPath, serializedConfig, 'utf8');

  // Create __screenshots__ directory and generate custom filename
  const screenshotsDir = join(PROJECT_ROOT, '__screenshots__');
  mkdirSync(screenshotsDir, { recursive: true });

  const chartTitleKebab = toKebabCase(config.outputName || 'untitled-widget');
  const timestamp = Date.now().toString();
  const customFilename = `widget-${chartTitleKebab}-${timestamp}.png`;
  const screenshotPath = join(screenshotsDir, customFilename);

  // Resolve test file path relative to project root
  const testFilePath = join(PROJECT_ROOT, 'src/utils/widget-renderer/widget-renderer.spec.tsx');

  // Run Playwright CT (browser launches on-demand)
  return new Promise((resolve) => {
    const renderStart = Date.now();

    // Use npx with full environment inheritance to ensure PATH includes Volta/bin
    const playwrightProcess = spawn(
      'npx',
      ['playwright', 'test', '--config=playwright-ct.config.ts', testFilePath, '--reporter=list'],
      {
        cwd: PROJECT_ROOT,
        env: {
          ...process.env, // Inherit full environment including PATH
          WIDGET_CONFIG_PATH: configPath,
          SCREENSHOT_OUTPUT_PATH: screenshotPath,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let stdout = '';
    let stderr = '';

    playwrightProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
      // Don't log to console as it interferes with MCP protocol
    });

    playwrightProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
      // Don't log to console as it interferes with MCP protocol
    });

    playwrightProcess.on('close', (code) => {
      const renderMs = Date.now() - renderStart;
      const totalMs = Date.now() - startTime;

      if (code === 0) {
        resolve({
          pngPath: screenshotPath,
          success: true,
          timings: {
            renderMs,
            totalMs,
          },
        });
      } else {
        resolve({
          pngPath: screenshotPath,
          success: false,
          error: stderr || stdout,
          timings: {
            renderMs,
            totalMs,
          },
        });
      }
    });
  });
}
