---
title: Sisense MCP Server Quick Start Guide
---

# Sisense MCP Server Quick Start Guide

## Prerequisites

- Node.js 18.0.0 or later (required for `npm` / local development)
- Bun runtime for project scripts (`dev`, `build`, `start`, tests): the `bun` package is listed in `devDependencies`, so `npm install` or `bun install` places the Bun binary in `node_modules/.bin`—you do **not** need Bun installed globally. Installing [Bun](https://bun.sh) globally is optional and can be faster for everyday use.
- Access to a Sisense instance
- A Sisense API token
- Playwright Chromium (installed automatically by `bun install` / `npm install` via `postinstall`)

## Clone and Install

If you have not done so already, clone the repository:

```bash
git clone git@github.com:sisense/sisense-mcp-server.git
cd sisense-mcp-server
# Install dependencies
bun install
# or
npm install
```

## Configure Environment

Create an `.env` file in the project root:

```env
SISENSE_URL=https://your-instance.sisense.com
SISENSE_TOKEN=your-api-token-here
```

### Get Your API Token

1. Log in to your Sisense instance.
2. Navigate to your profile settings.
3. Generate an API token.
4. Copy it to the `.env` file.

## Start the Server

```bash
# Development mode (with hot reload)
bun run dev
# or
npm run dev

# Production mode
bun run build && bun run start
# or
npm run build && npm run start
```

The following appears (default port **3001**; use your `PORT` if set):

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

## Verify Installation

Test the endpoint by entering the following command (replace **3001** with your `PORT` from `.env` if you changed it):

```bash
curl http://localhost:3001/health
```

The following response should appear:

```json
{
  "status": "ok",
  "version": "x.x.x",
  "activeSessions": 0
}
```

## Configure Your MCP Client

### For Cursor IDE

1. Open Cursor settings and navigate to MCP settings.
2. Add the server configuration:

```json
{
  "mcpServers": {
    "sisense-analytics": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

**Note:** Depending on your network or client environment, the localhost HTTP setup may not connect. In those cases, you will need to expose your local server publicly via HTTPS using a proxy service such as [ngrok](https://ngrok.com/). Use the same `/mcp` path on your HTTPS URL, and add `sisenseUrl` and `sisenseToken` to that URL if the server is not started with `SISENSE_URL` and `SISENSE_TOKEN` in its environment.

With credentials in `.env` (recommended for local use), the `url` above is enough. If you prefer credentials on the URL, see [Configuration](./configuration.md).

3. Restart Cursor.

### For Claude Desktop

1. Edit `claude_desktop_config.json` (location varies by OS).
2. Add the server configuration (same JSON as above).
3. Restart Claude Desktop.

Optional server behavior (for example an extra query tool, MCP App vs image mode) is controlled with environment variables or URL parameters. See [Configuration](./configuration.md).

## Test the Tools

Once connected, type the following in your MCP client to make sure everything is working. The prompts below are example phrasings — you can word them naturally; your AI client sends them to the right tools automatically.

**List data sources** (replace with your own instance's data source names):

```text
get my Sisense data sources
```

**Get fields for a data source:**

```text
get fields for "Sample ECommerce"
```

**Create a chart:**

```text
build a chart for "Sample ECommerce" showing total revenue by month
```

Charts are rendered and accessible at `http://localhost:3001/screenshots/` (or in the app UI if your MCP client supports MCP Apps).

## Troubleshooting

### Server will not start

**Problem:** `SISENSE_URL and SISENSE_TOKEN environment variables are required`

**Solution:**

- Check that `.env` file exists in project root
- Verify both variables are set
- Restart the server

### Cannot connect to Sisense

**Problem:** `Failed to initialize Sisense clients`

**Solution:**

- Verify `SISENSE_URL` is correct and accessible from the machine running the server
- Check that `SISENSE_TOKEN` is valid and not expired

### Tools not appearing

**Problem:** MCP client does not show Sisense tools

**Solution:**

- Restart your MCP client
- Check server logs for errors
- Verify MCP client configuration is correct
- Ensure server is running: `curl http://localhost:3001/health`

### Chart creation fails

**Problem:** `Failed to create chart`

**Solution:**

- Verify data source name is exact (case-sensitive)
- Check that data source has required fields
- Try a simpler prompt first
- Check server logs for detailed error

## Next Steps

- Read the [repository README](../../README.md) for development commands, security, and the feature-flag reference table
- See [Configuration](./configuration.md) for credentials, tunneling, and flag examples
- See [usage examples](./usage-examples.md) for prompts and workflows
- See the [product FAQ](./faq.md) for common questions
- Review the code structure in the `src/` directory

---

Copyright © 2026 Sisense Inc. All rights reserved.
