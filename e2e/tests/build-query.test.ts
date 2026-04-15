// IMPORTANT: Import test-setup FIRST to ensure browser mock is initialized
// before any SDK imports happen. The module-level initialization in test-setup.ts
// will run automatically when this module is imported.
import '../helpers/test-setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'bun:test';
import { createMcpTestFixture } from '../helpers/mcp-fixtures.js';
import { assertNoError } from '../helpers/test-utils.js';
import { setupE2ETests } from '../helpers/test-setup.js';

describe('Build Query Tool E2E', () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    await setupE2ETests();
  });

  beforeEach(() => {
    savedEnv = { ...process.env };
    // Enable buildQuery for all tests by default; individual tests may override
    process.env.TOOL_BUILD_QUERY_ENABLED = 'true';
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it(
    'should call buildQuery tool and return queryId and dataset',
    async () => {
      const { TOOL_NAME_BUILD_QUERY } = await import('@sisense/sdk-ai-core');
      const { client } = await createMcpTestFixture();

      const result = await client.callTool({
        name: TOOL_NAME_BUILD_QUERY,
        arguments: {
          dataSourceTitle: 'Sample ECommerce',
          queryPrompt: 'Show total revenue by month',
        },
      });

      expect(result).toBeDefined();
      assertNoError(result);

      const structured = result.structuredContent as Record<string, unknown>;
      expect(structured).toHaveProperty('success', true);
      expect(structured).toHaveProperty('queryId');
      expect(typeof structured.queryId).toBe('string');
      expect((structured.queryId as string).length).toBeGreaterThan(0);
      expect(structured).toHaveProperty('dataset');
      expect(structured).toHaveProperty('message');
    },
    { timeout: 60000 },
  );

  it(
    'should persist QueryResult in session state under query-${queryId}',
    async () => {
      const { TOOL_NAME_BUILD_QUERY } = await import('@sisense/sdk-ai-core');
      const { client, sessionState } = await createMcpTestFixture();

      const result = await client.callTool({
        name: TOOL_NAME_BUILD_QUERY,
        arguments: {
          dataSourceTitle: 'Sample ECommerce',
          queryPrompt: 'Show total revenue by month',
        },
      });

      assertNoError(result);

      const structured = result.structuredContent as Record<string, unknown>;
      const queryId = structured.queryId as string;

      const stored = sessionState.get(`query-${queryId}`) as Record<string, unknown> | undefined;
      expect(stored).toBeDefined();
      expect(stored).toHaveProperty('queryId', queryId);
      expect(stored).toHaveProperty('nlqResult');

      const nlqResult = stored!.nlqResult as Record<string, unknown>;
      expect(nlqResult).toHaveProperty('chartState');
    },
    { timeout: 60000 },
  );

  it(
    'should call buildQuery then buildChart with queryId (no redundant NLQ call)',
    async () => {
      const { TOOL_NAME_BUILD_QUERY, TOOL_NAME_BUILD_CHART } = await import('@sisense/sdk-ai-core');
      const { client } = await createMcpTestFixture();

      // Step 1: Run query
      const queryResult = await client.callTool({
        name: TOOL_NAME_BUILD_QUERY,
        arguments: {
          dataSourceTitle: 'Sample ECommerce',
          queryPrompt: 'Show total revenue by month',
        },
      });

      assertNoError(queryResult);
      const queryStructured = queryResult.structuredContent as Record<string, unknown>;
      const queryId = queryStructured.queryId as string;
      expect(queryId).toBeTruthy();

      // Step 2: Build chart using the queryId from step 1
      const chartResult = await client.callTool({
        name: TOOL_NAME_BUILD_CHART,
        arguments: {
          dataSourceTitle: 'Sample ECommerce',
          userPrompt: 'Show total revenue by month as a bar chart',
          queryId,
        },
      });

      assertNoError(chartResult);
      const chartStructured = chartResult.structuredContent as Record<string, unknown>;
      expect(chartStructured).toHaveProperty('success', true);
      expect(chartStructured).toHaveProperty('chartId');
      expect(typeof chartStructured.chartId).toBe('string');
    },
    { timeout: 120000 },
  );

  it(
    'should return error for a prompt that fails NLQ (useful for debugging responseError)',
    async () => {
      const { TOOL_NAME_BUILD_QUERY } = await import('@sisense/sdk-ai-core');
      const { client } = await createMcpTestFixture();

      // Use the exact prompt from the bug report
      const result = await client.callTool({
        name: TOOL_NAME_BUILD_QUERY,
        arguments: {
          dataSourceTitle: 'Sample ECommerce',
          queryPrompt:
            'Show total revenue by month. Return one row per month with month and total revenue.',
        },
      });

      // Log result regardless of success/failure so we can see the full error
      console.log('[debug] buildQuery result:', JSON.stringify(result.structuredContent, null, 2));

      if (result.isError) {
        const structured = result.structuredContent as Record<string, unknown>;
        console.log('[debug] error message:', structured.message);
        // Test is informational — fail with a descriptive message
        throw new Error(
          `buildQuery failed: ${structured.message}\nFull result: ${JSON.stringify(structured)}`,
        );
      }

      const structured = result.structuredContent as Record<string, unknown>;
      expect(structured).toHaveProperty('success', true);
      expect(structured).toHaveProperty('queryId');
    },
    { timeout: 60000 },
  );

  it(
    'buildQuery tool is NOT registered when TOOL_BUILD_QUERY_ENABLED is false',
    async () => {
      // Override the beforeEach default (afterEach will restore)
      process.env.TOOL_BUILD_QUERY_ENABLED = 'false';

      const { TOOL_NAME_BUILD_QUERY } = await import('@sisense/sdk-ai-core');
      const { client } = await createMcpTestFixture();

      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);
      expect(toolNames).not.toContain(TOOL_NAME_BUILD_QUERY);
    },
    { timeout: 30000 },
  );

  it(
    'buildQuery tool IS registered when TOOL_BUILD_QUERY_ENABLED is true',
    async () => {
      const { TOOL_NAME_BUILD_QUERY } = await import('@sisense/sdk-ai-core');
      const { client } = await createMcpTestFixture();

      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);
      expect(toolNames).toContain(TOOL_NAME_BUILD_QUERY);
    },
    { timeout: 30000 },
  );
});
