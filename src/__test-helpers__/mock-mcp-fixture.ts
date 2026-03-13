/**
 * MCP test fixture using InMemoryTransport with mocked SDK dependencies.
 * Adapts the pattern from e2e/helpers/mcp-fixtures.ts for CI-safe testing.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupMcpServer } from '@/mcp-server.js';
import type { SessionState } from '@/types/sessions.js';
import { createMockSessionState } from './mock-session-state.js';

export interface MockMcpFixture {
  client: Client;
  server: McpServer;
  sessionState: SessionState;
}

export async function createMockMcpFixture(
  sessionStateOverrides?: Record<string, unknown>,
): Promise<MockMcpFixture> {
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

  const sessionState = createMockSessionState(sessionStateOverrides);
  const server = await setupMcpServer(sessionState);
  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
  await client.connect(clientTransport);

  return { client, server, sessionState };
}
