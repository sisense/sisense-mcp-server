# Sisense MCP Server

A Model Context Protocol (MCP) server that provides integration with Sisense analytics platform. This server enables LLMs to interact with Sisense data models and create charts programmatically.

## Features

- **Transport Support**: Streamable HTTP/SSE (for HTTP-based clients like Claude Desktop)
- **Three MCP Tools**:
  - `getDataSources`: Retrieve Sisense data sources (or data models)
  - `getDataSourceFields`: List all available fields for a specific data source
  - `buildChart`: Build charts from natural language prompts
- **Per-Session Authentication**: Sisense credentials passed via URL parameters
- **TypeScript**: Full type safety and modern ESM support
- **Lightweight**: Pure Node.js HTTP server, no heavy frameworks
- **Fast**: Optimized for Bun runtime, also runs on Node.js

## Prerequisites

- **Bun >= 1.0.0** (recommended) or **Node.js >= 18.0.0**
- Sisense instance with API access
- Sisense API token

## Installation

```bash
bun install
```

## Usage

Start the server:

```bash
bun run dev
```

The server will display the connection URL:

```
Sisense MCP Server running on http://localhost:3000

Connect with:
  http://localhost:3000/mcp?sisenseUrl=<SISENSE_URL>&sisenseToken=<SISENSE_TOKEN>

Endpoints:
  Health: http://localhost:3000/health
  Screenshots: http://localhost:3000/screenshots/
```

### Connecting from Claude Desktop

Configure Claude Desktop to connect using the full URL with your Sisense credentials:

```
http://localhost:3000/mcp?sisenseUrl=https://your-instance.sisense.com&sisenseToken=your-api-token
```

Or via ngrok/public URL:

```
https://your-ngrok-url.ngrok-free.app/mcp?sisenseUrl=https://your-instance.sisense.com&sisenseToken=your-api-token
```

## Configuration

| Parameter      | Description                                                              |
| -------------- | ------------------------------------------------------------------------ |
| `sisenseUrl`   | Full URL to your Sisense instance (e.g., `https://instance.sisense.com`) |
| `sisenseToken` | Sisense API authentication token                                         |
| `PORT`         | (Optional) Server port, defaults to 3000                                 |

The server automatically derives its public base URL from request headers, so it works correctly behind proxies like ngrok.

## Development

```bash
# Run server in development mode with hot reload
bun run dev

# Build the project
bun run build

# Run tests
bun test

# Type checking
bun run type-check

# Lint
bun run lint
```

## Security Considerations

⚠️ NEVER commit credentials to version control
⚠️ Use secret managers or vaults - NOT environment variables in production
⚠️ NEVER bind to 0.0.0.0 in production - use 127.0.0.1 or Unix socket
⚠️ NEVER connect to production Sisense - use dev/staging environments only
⚠️ Enable authentication - never run without auth
⚠️ Approve EVERY tool call - review all parameters before execution
⚠️ Create dedicated Sisense service account with minimum required permissions
⚠️ Rotate credentials regularly (every 90 days recommended)
