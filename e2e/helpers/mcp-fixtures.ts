import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupMcpServer } from '@/mcp-server.js';
import type { SessionState } from '@/types/sessions.js';

export interface McpTestFixture {
  client: Client;
  server: McpServer;
  sessionState: SessionState;
}

/**
 * Creates a complete MCP test fixture with connected client and server.
 * This helper eliminates duplication across test files.
 */
export async function createMcpTestFixture(): Promise<McpTestFixture> {
  // Create InMemoryTransport pair
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

  // Create session state with credentials and clients
  const { createTestSessionState } = await import('./test-utils.js');
  const sessionState = await createTestSessionState();
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

  return {
    client,
    server,
    sessionState,
  };
}
