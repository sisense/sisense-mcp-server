// IMPORTANT: Import test-setup FIRST to ensure browser mock is initialized
// before any SDK imports happen.
import '../helpers/test-setup.js';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createMcpTestFixture } from '../helpers/mcp-fixtures.js';
import { assertNoError } from '../helpers/test-utils.js';
import { setupE2ETests } from '../helpers/test-setup.js';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

describe('Analytics App Render E2E', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    // Force MCP App mode so buildChart returns _meta with serializedWidgetProps
    savedEnv.TOOL_CHART_BUILDER_MCP_APP_ENABLED = process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED;
    process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED = 'true';
    await setupE2ETests();
  });

  it(
    'should render an interactive chart via the MCP App protocol',
    async () => {
      // 1. Call buildChart via MCP to get a real tool result with _meta
      const { TOOL_NAME_CHART_BUILDER } = await import('@sisense/sdk-ai-core');
      const { client } = await createMcpTestFixture();

      const result = await client.callTool({
        name: TOOL_NAME_CHART_BUILDER,
        arguments: {
          dataSourceTitle: 'Sample ECommerce',
          userPrompt: 'show me total revenue by month with trend and forecast',
        },
      });

      expect(result).toBeDefined();
      assertNoError(result);

      // 2. Verify the result has _meta with required fields for MCP App
      const meta = result._meta as Record<string, unknown> | undefined;
      expect(meta).toBeDefined();
      expect(meta).toHaveProperty('sisenseUrl');
      expect(meta).toHaveProperty('sisenseToken');
      expect(meta).toHaveProperty('serializedWidgetProps');

      // 3. Persist only the minimal fields Playwright/app need (no full result with token in extra keys)
      if (!meta) throw new Error('_meta required for Playwright payload');
      const testId = randomBytes(8).toString('hex');
      const testDir = join(tmpdir(), `analytics-app-${testId}`);
      const toolResultPath = join(testDir, 'tool-result.json');
      try {
        mkdirSync(testDir, { recursive: true });
        const minimalResult = {
          _meta: {
            sisenseUrl: meta.sisenseUrl,
            sisenseToken: meta.sisenseToken,
            serializedWidgetProps: meta.serializedWidgetProps,
          },
        };
        writeFileSync(toolResultPath, JSON.stringify(minimalResult), {
          encoding: 'utf8',
          mode: 0o600,
        });

        // 4. Spawn Playwright to run the browser test
        const projectRoot = process.cwd();
        const updateSnapshots =
          process.env.UPDATE_SNAPSHOTS === '1' || process.env.UPDATE_SNAPSHOTS === 'true';

        const playwrightArgs = [
          './node_modules/.bin/playwright',
          'test',
          '--config=playwright-analytics.config.ts',
          '--reporter=list',
          ...(updateSnapshots ? ['--update-snapshots'] : []),
        ];

        const exitCode = await new Promise<number | null>((resolve) => {
          const playwrightProcess = spawn('node', playwrightArgs, {
            cwd: projectRoot,
            env: {
              ...process.env,
              TOOL_RESULT_PATH: toolResultPath,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          });

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

          const killTimeout = setTimeout(() => {
            console.error('Playwright process timed out after 150s, killing...');
            playwrightProcess.kill('SIGKILL');
          }, 150_000);

          playwrightProcess.on('error', (err) => {
            clearTimeout(killTimeout);
            console.error('Failed to spawn Playwright:', err.message);
            resolve(1);
          });

          playwrightProcess.on('close', (code) => {
            clearTimeout(killTimeout);
            if (code !== 0) {
              console.error('Playwright stderr:', stderr);
              console.error('Playwright stdout:', stdout);
            }
            resolve(code);
          });
        });

        // 5. Assert Playwright test passed
        expect(exitCode).toBe(0);
      } finally {
        if (existsSync(testDir)) {
          rmSync(testDir, { recursive: true, force: true });
        }
      }
    },
    { timeout: 180_000 },
  );

  afterAll(() => {
    if (savedEnv.TOOL_CHART_BUILDER_MCP_APP_ENABLED !== undefined) {
      process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED = savedEnv.TOOL_CHART_BUILDER_MCP_APP_ENABLED;
    } else {
      delete process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED;
    }
  });
});
