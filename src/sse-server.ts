import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { fromTokenFile } from '@aws-sdk/credential-provider-web-identity';
import { initializeSisenseClients } from './initialize-sisense-clients.js';
import type { SessionState } from './types/sessions.js';
import { setupMcpServer } from './mcp-server.js';

// S3 client for proxying screenshots (if configured)
function createS3Client(): S3Client | null {
  if (!process.env.SCREENSHOTS_BUCKET) {
    return null;
  }
  const region = process.env.AWS_REGION || 'us-east-1';
  // Use web identity credentials in App Runner
  if (process.env.AWS_WEB_IDENTITY_TOKEN_FILE) {
    return new S3Client({ region, credentials: fromTokenFile() });
  }
  return new S3Client({ region });
}
const s3Client = createS3Client();

const PORT = process.env.PORT || 3000;

// MCP session ID → transport + state reference
const sessions = new Map<
  string,
  { transport: StreamableHTTPServerTransport; state: SessionState }
>();

// Credential hash → shared persistent state (survives session reconnects)
const persistentStates = new Map<string, SessionState>();

function getCredentialKey(sisenseUrl: string, sisenseToken: string): string {
  return createHash('sha256').update(`${sisenseUrl}:${sisenseToken}`).digest('hex').slice(0, 16);
}

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

  // Serve screenshot images (proxy from S3 or local filesystem)
  if (url.pathname.startsWith('/screenshots/') && req.method === 'GET') {
    try {
      const filename = url.pathname.replace('/screenshots/', '');

      // Validate filename (prevent path traversal)
      if (filename.includes('/') || filename.includes('..')) {
        console.error('Invalid screenshot filename:', filename);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Invalid screenshot path');
        return;
      }

      let imageBuffer: Buffer;

      if (s3Client && process.env.SCREENSHOTS_BUCKET) {
        // Fetch from S3
        const response = await s3Client.send(
          new GetObjectCommand({
            Bucket: process.env.SCREENSHOTS_BUCKET,
            Key: filename,
          }),
        );
        if (!response.Body) {
          throw new Error(`S3 response body is empty for ${filename}`);
        }
        imageBuffer = Buffer.from(await response.Body.transformToByteArray());
      } else {
        // Fallback to local filesystem
        const screenshotsDir = resolve(process.cwd(), '__screenshots__');
        const filePath = resolve(screenshotsDir, filename);

        // Verify the resolved path is within the screenshots directory
        if (!filePath.startsWith(screenshotsDir + sep) && filePath !== screenshotsDir) {
          console.error('Directory traversal attempt blocked:', filename);
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Invalid screenshot path');
          return;
        }

        imageBuffer = await readFile(filePath);
      }

      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400', // 24h cache for proxied images
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
        const sisenseUrl = url.searchParams.get('sisenseUrl');
        const sisenseToken = url.searchParams.get('sisenseToken');

        let state: SessionState;

        if (sisenseUrl && sisenseToken) {
          const credKey = getCredentialKey(sisenseUrl, sisenseToken);
          const existingState = persistentStates.get(credKey);

          if (existingState) {
            state = existingState;
          } else {
            try {
              // Validate inputs
              new URL(sisenseUrl); // throws if invalid URL
              if (!sisenseToken.trim()) {
                throw new Error('sisenseToken cannot be empty');
              }

              state = new Map();

              // Derive base URL from request headers (works with ngrok, proxies, etc.)
              const protocol = req.headers['x-forwarded-proto'] || 'http';
              const host = req.headers['x-forwarded-host'] || req.headers.host;
              const baseUrl = `${protocol}://${host}`;
              state.set('baseUrl', baseUrl);

              // Store credentials for chart rendering
              state.set('sisenseUrl', sisenseUrl);
              state.set('sisenseToken', sisenseToken);

              const {
                createHttpClientFromConfig,
                createOpenAIClient,
                initializeHttpClient,
                initializeOpenAIClient,
              } = await import('@sisense/sdk-ai-core');
              const httpClient = createHttpClientFromConfig({
                url: sisenseUrl,
                token: sisenseToken,
              });
              // Initialize the httpClient (required before use)
              if (initializeHttpClient) {
                initializeHttpClient(httpClient);
              }
              const openAIClient = createOpenAIClient(httpClient);
              // Initialize the openAIClient (required before use)
              initializeOpenAIClient(openAIClient);
              state.set('httpClient', httpClient);
              state.set('openAIClient', openAIClient);

              persistentStates.set(credKey, state);
            } catch (error) {
              console.error('Failed to initialize credential-based state:', error);
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  error: {
                    code: -32000,
                    message: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                  id: null,
                }),
              );
              return;
            }
          }
        } else {
          // No credentials - create ephemeral state
          state = new Map();
        }

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            sessions.set(id, { transport, state });
          },
          onsessionclosed: (id) => {
            sessions.delete(id);
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
      console.log(`Sisense MCP Server running on http://localhost:${PORT}`);
      console.log('');
      console.log('Connect with:');
      console.log(
        `  http://localhost:${PORT}/mcp?sisenseUrl=<SISENSE_URL>&sisenseToken=<SISENSE_TOKEN>`,
      );
      console.log('');
      console.log('Endpoints:');
      console.log(`  Health: http://localhost:${PORT}/health`);
      console.log(`  Screenshots: http://localhost:${PORT}/screenshots/`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize Sisense clients:', error);
    process.exit(1);
  });
