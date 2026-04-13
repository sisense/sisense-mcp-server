import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { createMockMcpFixture } from '@/__test-helpers__/mock-mcp-fixture.js';
import { MOCK_CHART_ID } from '@/__test-helpers__/mock-engines.js';

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
});

afterEach(() => {
  process.env = savedEnv;
});

describe('MCP Server - Tool Calls via Client', () => {
  describe('getDataSources', () => {
    it('returns valid content via MCP client', async () => {
      const { client } = await createMockMcpFixture();

      const result = await client.callTool({
        name: 'sisense-get-data-sources',
        arguments: {},
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);

      const structured = result.structuredContent as Record<string, unknown>;
      expect(structured).toBeDefined();
      expect(structured.dataSources).toBeDefined();
      expect(Array.isArray(structured.dataSources)).toBe(true);
    });
  });

  describe('getDataSourceFields', () => {
    it('returns fields via MCP client', async () => {
      const { client } = await createMockMcpFixture();

      const result = await client.callTool({
        name: 'sisense-get-data-source-fields',
        arguments: { dataSourceTitle: 'Sample ECommerce' },
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();

      const structured = result.structuredContent as Record<string, unknown>;
      expect(structured).toBeDefined();
      expect(structured.dataSourceTitle).toBe('Sample ECommerce');
      expect(structured.fields).toBeDefined();
    });
  });

  describe('buildChart - App Mode', () => {
    beforeEach(() => {
      delete process.env.MCP_APP_ENABLED;
      delete process.env.TOOL_BUILD_CHART_NARRATIVE_ENABLED;
    });

    it('returns success via MCP client', async () => {
      const { client } = await createMockMcpFixture();

      const result = await client.callTool({
        name: 'sisense-build-chart',
        arguments: {
          dataSourceTitle: 'Sample ECommerce',
          userPrompt: 'show me total revenue by month',
        },
      });

      expect(result).toBeDefined();
      expect(result.isError).not.toBe(true);

      const structured = result.structuredContent as Record<string, unknown>;
      expect(structured).toBeDefined();
      expect(structured.success).toBe(true);
      expect(structured.chartId).toBe(MOCK_CHART_ID);
      expect(typeof structured.message).toBe('string');
    });

    it('does not include _meta in tool response and chart payload is fetchable via resource', async () => {
      const { client } = await createMockMcpFixture();

      const result = await client.callTool({
        name: 'sisense-build-chart',
        arguments: {
          dataSourceTitle: 'Sample ECommerce',
          userPrompt: 'show revenue',
        },
      });

      expect(result._meta).toBeUndefined();

      const structured = result.structuredContent as Record<string, unknown>;
      const chartId = structured.chartId as string;
      expect(chartId).toBe(MOCK_CHART_ID);

      const resource = await client.readResource({
        uri: `ui://sisense-analytics/chart/${chartId}`,
      });
      const text = (resource.contents[0] as { text?: string }).text;
      expect(text).toBeDefined();
      const payload = JSON.parse(text!) as Record<string, unknown>;
      expect(payload.sisenseUrl).toBe('https://mock.sisense.com');
      expect(payload.sisenseToken).toBe('mock-token-abc123');
      expect(payload.serializedWidgetProps).toBeDefined();
    });

    it('updates session state with chart summaries', async () => {
      const { client, sessionState } = await createMockMcpFixture();

      await client.callTool({
        name: 'sisense-build-chart',
        arguments: {
          dataSourceTitle: 'Sample ECommerce',
          userPrompt: 'show revenue',
        },
      });

      const summaries = sessionState.get('chart:summaries') as unknown[];
      expect(summaries).toBeDefined();
      expect(Array.isArray(summaries)).toBe(true);
      expect(summaries.length).toBeGreaterThan(0);
    });
  });

  describe('buildChart - Tool Mode', () => {
    beforeEach(() => {
      process.env.MCP_APP_ENABLED = 'false';
      process.env.TOOL_BUILD_CHART_NARRATIVE_ENABLED = 'false';
    });

    it('returns imageUrl in tool mode', async () => {
      const { client } = await createMockMcpFixture();

      const result = await client.callTool({
        name: 'sisense-build-chart',
        arguments: {
          dataSourceTitle: 'Sample ECommerce',
          userPrompt: 'show revenue',
        },
      });

      const structured = result.structuredContent as Record<string, unknown>;
      expect(structured.success).toBe(true);
      expect(typeof structured.imageUrl).toBe('string');
    });
  });

  describe('Error responses', () => {
    it('returns MCP-formatted error when engine fails', async () => {
      const { buildChartEngine } = await import('@sisense/sdk-ai-core');

      (buildChartEngine as ReturnType<typeof mock>).mockImplementationOnce(async () => {
        throw new Error('Service timeout');
      });

      delete process.env.MCP_APP_ENABLED;
      const { client } = await createMockMcpFixture();

      const result = await client.callTool({
        name: 'sisense-build-chart',
        arguments: {
          dataSourceTitle: 'Sample ECommerce',
          userPrompt: 'show revenue',
        },
      });

      expect(result.isError).toBe(true);
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);

      const structured = result.structuredContent as Record<string, unknown>;
      expect(structured.success).toBe(false);
      expect(structured.message as string).toContain('Failed to create chart');
    });
  });
});
