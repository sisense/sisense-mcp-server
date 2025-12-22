import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { initializeSisenseClients } from './initialize-sisense-clients.js';
import type { SessionState } from './types/sessions.js';
import { setupMcpServer } from './mcp-server.js';

const PORT = process.env.PORT || 3000;

const sessions = new Map<
  string,
  { transport: StreamableHTTPServerTransport; state: SessionState }
>();

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        activeSessions: sessions.size,
      }),
    );
    return;
  }

  // Serve screenshot images
  if (url.pathname.startsWith('/screenshots/') && req.method === 'GET') {
    try {
      const filename = url.pathname.replace('/screenshots/', '');

      // Prevent directory traversal attacks
      const screenshotsDir = resolve(process.cwd(), '__screenshots__');
      const filePath = resolve(screenshotsDir, filename);

      // Verify the resolved path is within the screenshots directory
      if (!filePath.startsWith(screenshotsDir + sep) && filePath !== screenshotsDir) {
        console.error('Directory traversal attempt blocked:', filename);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Invalid screenshot path');
        return;
      }

      const imageBuffer = await readFile(filePath);

      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(imageBuffer);
    } catch (error) {
      console.error('Error serving screenshot:', error);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Screenshot not found');
    }
    return;
  }

  if (url.pathname === '/mcp') {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      await new Promise((resolve) => req.on('end', resolve));
      const parsedBody = JSON.parse(body);

      let transport: StreamableHTTPServerTransport;

      const existingSession = sessionId ? sessions.get(sessionId) : undefined;

      if (existingSession) {
        transport = existingSession.transport;
      } else if (!sessionId && isInitializeRequest(parsedBody)) {
        const state: SessionState = new Map();

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            sessions.set(id, { transport, state });
            console.log(`Session initialized: ${id}`);
          },
          onsessionclosed: (id) => {
            sessions.delete(id);
            console.log(`Session closed: ${id}`);
          },
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            sessions.delete(transport.sessionId);
          }
        };

        const mcpServer = await setupMcpServer(state);
        await mcpServer.connect(transport);
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Invalid session or missing initialization',
            },
            id: null,
          }),
        );
        return;
      }

      await transport.handleRequest(req, res, parsedBody);
      return;
    }

    if (req.method === 'GET') {
      const session = sessionId ? sessions.get(sessionId) : undefined;

      if (session) {
        await session.transport.handleRequest(req, res);
      } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid session');
      }
      return;
    }

    if (req.method === 'DELETE') {
      const session = sessionId ? sessions.get(sessionId) : undefined;

      if (session) {
        await session.transport.handleRequest(req, res);
      } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid session');
      }
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Initialize Sisense clients before starting server
initializeSisenseClients()
  .then(() => {
    server.listen(Number(PORT), () => {
      console.log(`Sisense MCP Server (SSE) running on http://localhost:${PORT}`);
      console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Screenshots: http://localhost:${PORT}/screenshots/`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize Sisense clients:', error);
    process.exit(1);
  });
