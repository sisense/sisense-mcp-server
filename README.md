# Sisense MCP Server

A Model Context Protocol (MCP) server that provides integration with Sisense analytics platform. This server enables LLMs to interact with Sisense data models and create charts programmatically.

## Features

- **Transport**: Streamable HTTP (`streamable-http`) for HTTP-based MCP clients (for example Claude Desktop, Cursor)
- **MCP tools** (three by default; optional fourth when enabled):
  - `getDataSources`: Retrieve Sisense data sources (or data models)
  - `getDataSourceFields`: List all available fields for a specific data source
  - `buildChart`: Build charts from natural language prompts
  - `buildQuery` (optional): Run analytics queries when `TOOL_BUILD_QUERY_ENABLED` / `toolBuildQueryEnabled` is enabled
- **MCP Apps**: When used in MCP Apps–capable clients (for example Claude), `buildChart` exposes an interactive View that renders the chart in an iframe within the app.
- **Per-session authentication**: Sisense credentials via URL parameters and/or server environment variables
- **TypeScript**: Full type safety and modern ESM support
- **Lightweight**: Pure Node.js HTTP server, no heavy frameworks
- **Fast**: Optimized for Bun runtime, also runs on Node.js

## Documentation

- [Quick start](docs/guides/quickstart.md) — clone, `.env`, run, MCP client setup
- [Configuration](docs/guides/configuration.md) — credentials, tunneling, feature flags, URL examples
- [FAQ](docs/guides/faq.md) — common questions and troubleshooting
- [Usage examples](docs/guides/usage-examples.md) — prompts and workflows

## Prerequisites

- **Bun >= 1.0.0** (recommended) or **Node.js >= 18.0.0**
- Sisense instance with API access
- Sisense API token
- Playwright Chromium (installed automatically by `bun install` / `npm install` via `postinstall`)

## Installation

```bash
bun install
```

## Usage

Start the server:

```bash
# Development mode (hot reload)
bun run dev

# Production mode
bun run build
bun run start
```

Sessions are in-memory — chart state is lost if the server restarts.

The server prints something like the following (port defaults to **3001**, or `PORT` if set):

```text
Sisense MCP Server running on http://localhost:3001

Connect with:
  http://localhost:3001/mcp?sisenseUrl=<SISENSE_URL>&sisenseToken=<SISENSE_TOKEN>
  Or set SISENSE_URL and SISENSE_TOKEN in the environment and use http://localhost:3001/mcp

Optional feature-flag query params (override env vars per connection):
  mcpAppEnabled=true|false, toolBuildQueryEnabled=true|false, toolBuildChartNarrativeEnabled=true|false

Endpoints:
  Health: http://localhost:3001/health
  Screenshots: http://localhost:3001/screenshots/
```

### Connecting your MCP client

Use an MCP **streamable HTTP** URL. For Cursor, Claude Desktop, and similar clients, add a server entry with the MCP path (not the shell `bun` command).

If `SISENSE_URL` and `SISENSE_TOKEN` are set in the **server** environment (for example in `.env` loaded by the process that runs `bun run dev`), the client URL does not need to include credentials:

```json
{
  "mcpServers": {
    "sisense-analytics": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

**Note:** Depending on your network or client environment, the localhost HTTP setup may not connect. In those cases, you will need to expose your local server publicly via HTTPS using a proxy service such as [ngrok](https://ngrok.com/). Point the client at your HTTPS tunnel URL with the same `/mcp` path (and query parameters if you are not using server env credentials).

**Credentials:** If you do not use server env vars, put `sisenseUrl` and `sisenseToken` on the MCP URL as query parameters (URL params take precedence over env when both are present). Always percent-encode each value — see [Configuration: URL encoding](docs/guides/configuration.md#url-encoding-query-params) for details and examples.

Alternative connection patterns (placeholders only; use encoded values for real credentials):

```text
http://localhost:3001/mcp?sisenseUrl=https://your-instance.sisense.com&sisenseToken=your-api-token
```

With `SISENSE_URL` and `SISENSE_TOKEN` in the server environment only:

```text
http://localhost:3001/mcp
```

Behind a public HTTPS tunnel (example):

```text
https://your-ngrok-url.ngrok-free.app/mcp?sisenseUrl=https://your-instance.sisense.com&sisenseToken=your-api-token
```

## Configuration

| Parameter      | Description                                                              |
| -------------- | ------------------------------------------------------------------------ |
| `sisenseUrl`   | Full URL to your Sisense instance (e.g., `https://instance.sisense.com`). In the query string, pass the value **percent-encoded**. |
| `sisenseToken` | Sisense API authentication token. In the query string, pass the value **percent-encoded** (required if the token contains `&`, `=`, `+`, etc.). |
| `PORT`         | (Optional) Server port, defaults to 3001                                 |

The server automatically derives its public base URL from request headers, so it works correctly behind proxies like ngrok. For how to build encoded MCP URLs, see [URL encoding for query parameters](docs/guides/configuration.md#url-encoding-query-params).

### Optional feature-flag query parameters

Defaults suit most setups; change flags when you need a specific client behavior. For **when to use each flag**, copy-paste URL patterns, and env vs query string, see [docs/guides/configuration.md](docs/guides/configuration.md).

These query params override the corresponding env vars on a per-connection basis. Accepted values: `true`, `false`, `1`, `0` (case-insensitive).

| Query parameter                  | Env var equivalent                   | Default | Description                                                                  |
| -------------------------------- | ------------------------------------ | ------- | ---------------------------------------------------------------------------- |
| `mcpAppEnabled`                  | `MCP_APP_ENABLED`                    | `true`  | Renders the chart in an interactive app UI (supported in Claude); set to `false` for tool mode (image/screenshot output) |
| `toolBuildQueryEnabled`          | `TOOL_BUILD_QUERY_ENABLED`           | `false` | Enable the `buildQuery` tool for executing analytics queries                 |
| `toolBuildChartNarrativeEnabled` | `TOOL_BUILD_CHART_NARRATIVE_ENABLED` | `true`  | Include NLG narrative/insights in the build chart tool response              |

Example URL with all three overrides (encode `sisenseUrl` and `sisenseToken` values when they are not simple alphanumeric placeholders):

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
