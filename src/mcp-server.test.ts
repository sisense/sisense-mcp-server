import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createMockMcpFixture } from '@/__test-helpers__/mock-mcp-fixture.js';

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
});

afterEach(() => {
  process.env = savedEnv;
});

describe('MCP Server - Tool Registration', () => {
  it('registers exactly 3 tools', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.listTools();

    expect(result.tools).toHaveLength(3);
  });

  it('registers tools with expected names', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.listTools();
    const names = result.tools.map((t) => t.name).sort();

    expect(names).toEqual([
      'sisense-build-chart',
      'sisense-get-data-source-fields',
      'sisense-get-data-sources',
    ]);
  });

  it('each tool has title and description', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.listTools();

    for (const tool of result.tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it('buildChart has inputSchema with dataSourceTitle and userPrompt', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.listTools();
    const buildChart = result.tools.find((t) => t.name === 'sisense-build-chart');

    expect(buildChart).toBeDefined();
    expect(buildChart!.inputSchema).toBeDefined();
  });

  it('getDataSourceFields has inputSchema with dataSourceTitle', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.listTools();
    const tool = result.tools.find((t) => t.name === 'sisense-get-data-source-fields');

    expect(tool).toBeDefined();
    expect(tool!.inputSchema).toBeDefined();
  });
});

describe('MCP Server - App Resource Registration', () => {
  it('registers the analytics app resource', async () => {
    const { client } = await createMockMcpFixture();

    const result = await client.listResources();

    expect(result.resources.length).toBeGreaterThanOrEqual(1);
    const analyticsResource = result.resources.find(
      (r) => r.uri === 'ui://sisense-analytics/view.html',
    );
    expect(analyticsResource).toBeDefined();
  });
});
