---
title: Sisense MCP Server Configuration
---

# Sisense MCP Server Configuration

This guide covers how to connect MCP clients to the server, where to put Sisense credentials, tunneling, and optional feature flags.

## Credentials: server environment vs URL

**Server environment (recommended for local dev):** Set `SISENSE_URL` and `SISENSE_TOKEN` in `.env` or in the environment of the process that runs the server. MCP clients then use a short URL:

```text
http://localhost:3001/mcp
```

**URL query parameters:** Add `sisenseUrl` and `sisenseToken` to the MCP URL. Use this when the server runs without those env vars, or to override them for a specific client. **If both env vars and URL params are set, URL params take precedence.**

> **⚠️ Security note:** Embedding `sisenseToken` in a URL exposes it to browser history, client logs, proxy/tunnel logs, and server access logs. Prefer environment variables (`SISENSE_URL` / `SISENSE_TOKEN`) for any non-local or shared setup. Use URL query parameters only for local-only testing.

**JSON config vs shell:** The `mcpServers` block belongs in your MCP client configuration file (for example Cursor MCP settings or `claude_desktop_config.json`). Do not mix it into the same code block as `bun run dev`.

<a id="url-encoding-query-params"></a>

## URL encoding for query parameters

The server reads query parameters with normal URL parsing (values are **percent-decoded** after they arrive). When **you** build or edit an MCP URL that includes `sisenseUrl` and `sisenseToken`, encode **each parameter value** so reserved characters do not break the query string or get misread:

- **Encode** if the token or URL can contain `&`, `=`, `+`, `#`, `?`, spaces, non-ASCII, or other reserved characters (common in tokens).
- **Encoding every value** is the safest habit even for simple-looking URLs.

Use your language’s URI encoder on the **value only** (not the whole URL), for example:

- **JavaScript:** `encodeURIComponent(sisenseUrl)` and `encodeURIComponent(sisenseToken)`
- **Python:** `urllib.parse.quote(sisenseUrl, safe="")` (and same for the token)

Example of a fully encoded query (illustrative):

```text
http://localhost:3001/mcp?sisenseUrl=https%3A%2F%2Fyour-instance.sisense.com&sisenseToken=YOUR_ENCODED_TOKEN
```

Build the `url` string in one line, then paste it into the MCP client JSON `url` field:

```javascript
const base = "http://localhost:3001/mcp";
const url =
  `${base}?sisenseUrl=${encodeURIComponent(sisenseUrl)}&sisenseToken=${encodeURIComponent(sisenseToken)}`;
```

## Localhost MCP client snippet

```json
{
  "mcpServers": {
    "sisense-analytics": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

**Tunneling:** Depending on your network or client environment, the localhost HTTP setup may not connect. In those cases, expose your local server publicly via HTTPS using a proxy service such as [ngrok](https://ngrok.com/), then set `"url"` to your tunneled `https://.../mcp` URL (and include **percent-encoded** `sisenseUrl` / `sisenseToken` on that URL if the server does not have them in env).

## Feature flags: when to change them

Set flags via **environment variables** on the server process (applies to all connections) or **query parameters** on the MCP URL (per client). See the [README feature-flag table](../../README.md#optional-feature-flag-query-parameters) for names, env equivalents, and defaults.

In the example URLs below, `YOUR_TOKEN` and bare `https://…` values are placeholders. For real credentials, **percent-encode** `sisenseUrl` and `sisenseToken` as described in [URL encoding for query parameters](#url-encoding-query-params).

<a id="mcp-app-mode"></a>

### MCP App mode (`mcpAppEnabled` / `MCP_APP_ENABLED`)

- **Default `true`:** In MCP Apps–capable clients, charts can render inside the app UI.
- **Set `false`:** Use classic tool mode (for example chart as image / screenshot-oriented flow) when the client does not support apps or you want non-interactive output.

Minimal example (credentials on URL; disable MCP App):

```text
http://localhost:3001/mcp?sisenseUrl=https://your-instance.sisense.com&sisenseToken=YOUR_TOKEN&mcpAppEnabled=false
```

<a id="query-tool"></a>

### Query tool (`toolBuildQueryEnabled` / `TOOL_BUILD_QUERY_ENABLED`)

- **Default `false`:** The optional `buildQuery` tool is off.
- **Set `true`:** Enable natural-language analytics queries that return data (and can be chained with charting). Enable only when you need this capability.

Example enabling only `buildQuery` (other flags stay at defaults):

```text
http://localhost:3001/mcp?sisenseUrl=https://your-instance.sisense.com&sisenseToken=YOUR_TOKEN&toolBuildQueryEnabled=true
```

<a id="chart-narrative"></a>

### Chart narrative (`toolBuildChartNarrativeEnabled` / `TOOL_BUILD_CHART_NARRATIVE_ENABLED`)

- **Default `true`:** Chart tool responses can include NLG narrative or insights.
- **Set `false`:** Shorter responses when you want to reduce extra text from the model.

### Combined example

Same as the README “all three overrides” example:

```text
http://localhost:3001/mcp?sisenseUrl=https://your-instance.sisense.com&sisenseToken=YOUR_TOKEN&mcpAppEnabled=false&toolBuildQueryEnabled=true&toolBuildChartNarrativeEnabled=false
```

With **env credentials** only, append flags to the base path:

```text
http://localhost:3001/mcp?mcpAppEnabled=false&toolBuildQueryEnabled=true
```

### Public HTTPS URL (ngrok)

Replace the host with your tunnel origin; keep `/mcp` and your query string:

```text
https://your-subdomain.ngrok-free.app/mcp?sisenseUrl=https://your-instance.sisense.com&sisenseToken=YOUR_TOKEN
```

## Related docs

- [Quick start](./quickstart.md) — first-time setup
- [FAQ](./faq.md) — troubleshooting and common questions
- [Repository README](../../README.md) — development commands and security

---

Copyright © 2026 Sisense Inc. All rights reserved.
