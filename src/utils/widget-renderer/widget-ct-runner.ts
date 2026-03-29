import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { ChartWidgetProps, SisenseContextProviderProps } from '@sisense/sdk-ui';
import { CustomSuperJSON } from '@sisense/sdk-ui/analytics-composer/node';
import { toKebabCase } from '@/utils/string-utils';

// Get the project root directory reliably
// In dev: src/utils/widget-renderer -> go up 3 levels
// In prod (bundled): dist/ -> use cwd() which is /app
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getProjectRoot(): string {
  // Try process.cwd() first (works in Docker where WORKDIR is /app)
  const cwd = process.cwd();
  if (existsSync(join(cwd, 'playwright-ct.config.ts'))) {
    return cwd;
  }
  // Fall back to relative path calculation (works in dev)
  const relativePath = join(__dirname, '..', '..', '..');
  if (existsSync(join(relativePath, 'playwright-ct.config.ts'))) {
    return relativePath;
  }
  // Default to cwd if neither works
  return cwd;
}

const PROJECT_ROOT = getProjectRoot();

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

  let screenshotPath = '';

  try {
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
    const customFilename = `widget-${chartTitleKebab}-${randomUUID()}.png`;
    screenshotPath = join(screenshotsDir, customFilename);

    // Resolve test file path relative to project root
    const testFilePath = join(PROJECT_ROOT, 'src/utils/widget-renderer/widget-renderer.spec.tsx');

    // Run Playwright CT (browser launches on-demand)
    return await new Promise((resolve) => {
      const renderStart = Date.now();

      console.info('Starting Playwright CT', {
        cwd: PROJECT_ROOT,
        testFile: testFilePath,
        configPath,
        screenshotPath,
        chromiumPath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      });

      // Use node to run playwright (Bun doesn't work well with Playwright)
      const playwrightProcess = spawn(
        'node',
        [
          './node_modules/.bin/playwright',
          'test',
          '--config=playwright-ct.config.ts',
          testFilePath,
          '--reporter=list',
        ],
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

      console.info('Playwright process spawned', { pid: playwrightProcess.pid });

      let stdout = '';
      let stderr = '';

      playwrightProcess.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        console.info('Playwright stdout:', chunk.trim());
      });

      playwrightProcess.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        console.info('Playwright stderr:', chunk.trim());
      });

      // Add a timeout to force kill the process if it hangs
      // Vite build takes ~20s, chart rendering can take 30s+, so 120s total
      const killTimeout = setTimeout(() => {
        console.error('Playwright process timed out after 120s, killing...');
        playwrightProcess.kill('SIGKILL');
      }, 120000);

      // Handle spawn errors (e.g., bun not found)
      playwrightProcess.on('error', (err) => {
        clearTimeout(killTimeout);
        const totalMs = Date.now() - startTime;
        resolve({
          pngPath: screenshotPath,
          success: false,
          error: `Failed to spawn Playwright process: ${err.message}`,
          timings: {
            renderMs: 0,
            totalMs,
          },
        });
      });

      playwrightProcess.on('close', (code) => {
        clearTimeout(killTimeout);
        console.info('Playwright process exited', {
          code,
          stdoutLength: stdout.length,
          stderrLength: stderr.length,
        });
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
  } catch (err) {
    // Catch any synchronous errors (file operations, etc.)
    const totalMs = Date.now() - startTime;
    return {
      pngPath: screenshotPath,
      success: false,
      error: `Failed to create chart: ${err instanceof Error ? err.message : String(err)}`,
      timings: {
        renderMs: 0,
        totalMs,
      },
    };
  }
}
