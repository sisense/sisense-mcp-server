import { describe, it, expect } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { setupMcpServer } from '../mcp-server.js';
import { initializeSisenseClients } from '../initialize-sisense-clients.js';
import type { SessionState } from '@/types/sessions.js';

/**
 * Checks for error conditions in tool call result and throws if an error is detected.
 * Detects errors via isError flag or by checking for "failed" text in content.
 */
function assertNoError(result: unknown): void {
  // Check for error conditions - detect isError flag or error text in content
  if (
    typeof result === 'object' &&
    result !== null &&
    'isError' in result &&
    result.isError === true
  ) {
    const errorMessage =
      'content' in result && Array.isArray(result.content) && result.content.length > 0
        ? (result.content[0] as { text?: string }).text || 'Unknown error'
        : 'Error occurred';
    throw new Error(`Tool call failed: ${errorMessage}`);
  }

  // Check content for error messages (even if isError is not set)
  if (
    typeof result === 'object' &&
    result !== null &&
    'content' in result &&
    Array.isArray(result.content) &&
    result.content.length > 0
  ) {
    const firstContent = result.content[0] as { type?: string; text?: string };
    if (firstContent.type === 'text' && typeof firstContent.text === 'string') {
      if (firstContent.text.toLowerCase().includes('failed')) {
        throw new Error(`Tool call failed: ${firstContent.text}`);
      }
    }
  }
}

describe('MCP Client Integration Tests', async () => {
  await initializeSisenseClients();
  console.log('Sisense clients initialized');

  const { TOOL_NAME_CHART_BUILDER, TOOL_NAME_GET_DATA_SOURCE_FIELDS, TOOL_NAME_GET_DATA_SOURCES } =
    await import('@sisense/sdk-ai-core');

  it(
    `should call ${TOOL_NAME_GET_DATA_SOURCES} tool via MCP client`,
    async () => {
      // Create InMemoryTransport pair
      const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

      const server = await setupMcpServer();
      await server.connect(serverTransport);

      // Create MCP Client, connect to client transport
      const client = new Client(
        {
          name: 'test-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        },
      );
      await client.connect(clientTransport);

      // Call get-data-sources tool via client.callTool()
      const result = await client.callTool({
        name: TOOL_NAME_GET_DATA_SOURCES,
        arguments: {},
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
    },
    { timeout: 60000 },
  );

  it(
    `should call ${TOOL_NAME_GET_DATA_SOURCE_FIELDS} tool via MCP client`,
    async () => {
      // Create InMemoryTransport pair
      const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

      const server = await setupMcpServer();
      await server.connect(serverTransport);

      // Create MCP Client, connect to client transport
      const client = new Client(
        {
          name: 'test-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        },
      );
      await client.connect(clientTransport);

      // Call get-data-source-fields tool via client.callTool()
      const result = await client.callTool({
        name: TOOL_NAME_GET_DATA_SOURCE_FIELDS,
        arguments: {
          dataSourceTitle: 'Sample ECommerce',
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
    },
    { timeout: 60000 },
  );

  it(
    `should call ${TOOL_NAME_CHART_BUILDER} tool via MCP client`,
    async () => {
      // Create InMemoryTransport pair
      const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

      // Create session state
      const sessionState: SessionState = new Map();

      const server = await setupMcpServer(sessionState);
      await server.connect(serverTransport);

      // Create MCP Client, connect to client transport
      const client = new Client(
        {
          name: 'test-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        },
      );
      await client.connect(clientTransport);

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
        const savedChartProps = sessionState.get(`chart:${chartId}`);
        console.log('Chart ID:', chartId);
        console.log('Saved chart props exists:', !!savedChartProps);
        console.log('Session state keys:', Array.from(sessionState.keys()));

        // Verify that chart props were saved (required for image generation)
        expect(savedChartProps).toBeDefined();
        expect(savedChartProps).toHaveProperty('chartType');
      }

      // imageUrl is optional; assert type only when present
      if ('structuredContent' in result && result.structuredContent) {
        const structured = result.structuredContent as { imageUrl?: unknown };
        if (structured.imageUrl != null) {
          expect(typeof structured.imageUrl).toBe('string');
        }
      }
    },
    { timeout: 60000 },
  );
});
