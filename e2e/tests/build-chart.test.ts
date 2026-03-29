// IMPORTANT: Import test-setup FIRST to ensure browser mock is initialized
// before any SDK imports happen. The module-level initialization in test-setup.ts
// will run automatically when this module is imported.
import '../helpers/test-setup.js';
import { describe, it, expect, beforeAll } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createMcpTestFixture } from '../helpers/mcp-fixtures.js';
import { assertNoError } from '../helpers/test-utils.js';
import { setupE2ETests } from '../helpers/test-setup.js';

/** PNG file signature (first 8 bytes). */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** UUID v4 (RFC 4122): random node id; enforces non-guessable screenshot suffix per widget-ct-runner. */
const UUID_V4_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Build Chart Tool E2E', () => {
  beforeAll(async () => {
    await setupE2ETests();
  });

  it(
    'should call build-chart tool via MCP client',
    async () => {
      // Dynamically import tool name after browser mock is initialized
      const { TOOL_NAME_CHART_BUILDER } = await import('@sisense/sdk-ai-core');
      const { client, sessionState } = await createMcpTestFixture();

      // Call build-chart tool via client.callTool()
      const result = await client.callTool({
        name: TOOL_NAME_CHART_BUILDER,
        arguments: {
          dataSourceTitle: 'Sample ECommerce',
          userPrompt: 'show me total revenue by month with trend',
        },
      });

      // Assert: Verify call succeeds and returns content
      expect(result).toBeDefined();
      assertNoError(result);

      // Verify successful response has content
      if ('content' in result && Array.isArray(result.content)) {
        expect(result.content.length).toBeGreaterThan(0);
      } else {
        // If structured content is returned instead
        expect(result).toBeTruthy();
      }

      // Verify session state was updated
      const chartSummaries = sessionState.get('chart:summaries');
      expect(chartSummaries).toBeDefined();
      expect(Array.isArray(chartSummaries)).toBe(true);
      if (Array.isArray(chartSummaries) && chartSummaries.length > 0) {
        expect(chartSummaries[0]).toHaveProperty('chartId');
        expect(chartSummaries[0]).toHaveProperty('message');

        // Debug: Check if chart props were saved
        const chartId = chartSummaries[0].chartId;
        const savedChartProps = sessionState.get(chartId);

        // Verify that chart props were saved (required for image generation)
        expect(savedChartProps).toBeDefined();
        expect(savedChartProps).toHaveProperty('chartType');
      }

      // Result structuredContent must contain schema fields (no chartPropsSerialized)
      const structured = result.structuredContent as Record<string, unknown> | undefined;
      if (structured) {
        expect(structured).not.toHaveProperty('chartPropsSerialized');
        expect(structured).toHaveProperty('success', true);
        expect(structured).toHaveProperty('chartId');
        expect(structured).toHaveProperty('message');
        expect(typeof structured.chartId).toBe('string');
        if (structured.imageUrl != null) {
          expect(typeof structured.imageUrl).toBe('string');
        }
        if (structured.insights != null && typeof structured.insights === 'string') {
          expect(structured.insights.length).toBeGreaterThan(0);
        }
      }

      // Credentials are in _meta (for MCP App mode)
      const meta = result._meta as Record<string, unknown> | undefined;
      if (meta) {
        expect(meta).toHaveProperty('sisenseUrl');
        expect(meta).toHaveProperty('sisenseToken');
        expect(typeof meta.sisenseUrl).toBe('string');
        expect(typeof meta.sisenseToken).toBe('string');
      }
    },
    { timeout: 60000 },
  );

  it(
    'when TOOL_CHART_BUILDER_NARRATIVE_ENABLED is false, buildChart succeeds and does not include insights',
    async () => {
      const prev = process.env.TOOL_CHART_BUILDER_NARRATIVE_ENABLED;
      process.env.TOOL_CHART_BUILDER_NARRATIVE_ENABLED = 'false';
      try {
        const { TOOL_NAME_CHART_BUILDER } = await import('@sisense/sdk-ai-core');
        const { client } = await createMcpTestFixture();

        const result = await client.callTool({
          name: TOOL_NAME_CHART_BUILDER,
          arguments: {
            dataSourceTitle: 'Sample ECommerce',
            userPrompt: 'show me total revenue by month with trend',
          },
        });

        expect(result).toBeDefined();
        assertNoError(result);

        const structured = result.structuredContent as Record<string, unknown> | undefined;
        expect(structured).toBeDefined();
        expect(structured).toHaveProperty('success', true);
        expect(structured).toHaveProperty('chartId');
        expect(structured).toHaveProperty('message');
        expect(structured).not.toHaveProperty('insights');
      } finally {
        if (prev !== undefined) {
          process.env.TOOL_CHART_BUILDER_NARRATIVE_ENABLED = prev;
        } else {
          delete process.env.TOOL_CHART_BUILDER_NARRATIVE_ENABLED;
        }
      }
    },
    { timeout: 60000 },
  );

  it(
    'should generate a chart image (tool mode: Playwright CT PNG on disk and imageUrl in result)',
    async () => {
      const prevApp = process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED;
      process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED = 'false';
      try {
        const { TOOL_NAME_CHART_BUILDER } = await import('@sisense/sdk-ai-core');
        const { client } = await createMcpTestFixture();

        const result = await client.callTool({
          name: TOOL_NAME_CHART_BUILDER,
          arguments: {
            dataSourceTitle: 'Sample ECommerce',
            userPrompt: 'show me total revenue by month with trend',
          },
        });

        expect(result).toBeDefined();
        assertNoError(result);

        const structured = result.structuredContent as Record<string, unknown> | undefined;
        expect(structured).toBeDefined();
        expect(structured).toHaveProperty('success', true);
        expect(structured?.imageUrl).toBeDefined();
        expect(typeof structured?.imageUrl).toBe('string');

        const imageUrl = structured!.imageUrl as string;
        expect(imageUrl).toContain('/screenshots/');
        expect(imageUrl.endsWith('.png')).toBe(true);

        expect(result._meta).toBeUndefined();

        const screenshotBasename = basename(new URL(imageUrl).pathname);
        const filename = screenshotBasename.replace(/\.png$/i, '');
        // widget-<kebab-title>-<uuid> (widget-ct-runner.ts); not a bare UUID — validate trailing segment via UUID_V4_PATTERN
        const uuidSuffix = filename.match(UUID_V4_PATTERN)?.[0];
        expect(uuidSuffix).toBeDefined();

        const localPath = join(process.cwd(), '__screenshots__', screenshotBasename);
        expect(existsSync(localPath)).toBe(true);

        const bytes = readFileSync(localPath);
        expect(bytes.length).toBeGreaterThan(500);
        expect(bytes.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
      } finally {
        if (prevApp !== undefined) {
          process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED = prevApp;
        } else {
          delete process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED;
        }
      }
    },
    { timeout: 180000 },
  );
});
