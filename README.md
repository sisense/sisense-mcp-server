# Sisense MCP Server

A Model Context Protocol (MCP) server that provides integration with Sisense analytics platform. This server enables LLMs to interact with Sisense data models and create charts programmatically.

## Features

- **Transport Support**: Streamable HTTP/SSE (for HTTP-based clients like Claude Desktop)
- **Three MCP Tools**:
  - `getDataSources`: Retrieve Sisense data sources (or data models)
  - `getDataSourceFields`: List all available fields for a specific data source
  - `buildChart`: Build charts from natural language prompts
- **MCP Apps**: When used in MCP Apps–capable clients (e.g. Claude), `buildChart` exposes an interactive View that renders the chart in an iframe within the app.
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
Sisense MCP Server running on http://localhost:3001

Connect with:
  http://localhost:3001/mcp?sisenseUrl=<SISENSE_URL>&sisenseToken=<SISENSE_TOKEN>

Endpoints:
  Health: http://localhost:3001/health
  Screenshots: http://localhost:3001/screenshots/
```

### Connecting from Claude Desktop

Credentials can be provided via URL params or via env vars `SISENSE_URL` and `SISENSE_TOKEN`. If both are set, URL params take precedence.

Configure Claude Desktop to connect using the full URL with your Sisense credentials:

```
http://localhost:3001/mcp?sisenseUrl=https://your-instance.sisense.com&sisenseToken=your-api-token
```

Or set `SISENSE_URL` and `SISENSE_TOKEN` in your environment and connect with:

```
http://localhost:3001/mcp
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
| `PORT`         | (Optional) Server port, defaults to 3001                                 |

The server automatically derives its public base URL from request headers, so it works correctly behind proxies like ngrok.

### Optional feature-flag query parameters

These query params override the corresponding env vars on a per-connection basis. Accepted values: `true`, `false`, `1`, `0` (case-insensitive).

| Query parameter                  | Env var equivalent                   | Default | Description                                                                  |
| -------------------------------- | ------------------------------------ | ------- | ---------------------------------------------------------------------------- |
| `mcpAppEnabled`                  | `MCP_APP_ENABLED`                    | `true`  | MCP App mode: interactive chart in app. Set to `false` for tool mode (image) |
| `toolBuildQueryEnabled`          | `TOOL_BUILD_QUERY_ENABLED`           | `false` | Enable the `buildQuery` tool for executing analytics queries                 |
| `toolBuildChartNarrativeEnabled` | `TOOL_BUILD_CHART_NARRATIVE_ENABLED` | `true`  | Include NLG narrative/insights in the build chart tool response              |

Example URL with all three overrides:

```text
http://localhost:3001/mcp?sisenseUrl=https://your-instance.sisense.com&sisenseToken=your-api-token&mcpAppEnabled=false&toolBuildQueryEnabled=true&toolBuildChartNarrativeEnabled=false
```

## Development

```bash
# Run server in development mode with hot reload
bun run dev

# Build the project (View + server)
bun run build

# Build only the analytics View (dist/view.html)
bun run build:view

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
