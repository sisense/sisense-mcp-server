---
title: Sisense MCP Server Product FAQ
---

# Sisense MCP Server Product FAQ

## General questions

### What is the Sisense MCP Server?

The Sisense MCP Server is a Model Context Protocol (MCP) server that enables AI assistants and LLMs to interact with the Sisense analytics platform. It provides tools to explore data sources, examine fields, and create charts using natural language prompts.

### What can I do with this server?

You can:

- List all available data sources in your Sisense instance
- Explore fields and structure of any data source
- Create charts and visualizations from natural language prompts
- Access chart screenshots via HTTP endpoints

### What MCP clients are supported?

The server uses **streamable HTTP** MCP transport (`streamable-http`), which is compatible with:

- Cursor IDE
- Claude Desktop
- Other MCP clients that support streamable HTTP to an `/mcp` URL

`stdio` transport is not supported — the server runs as a standalone HTTP process, not as a subprocess launched by the client.

### Do I need to know SQL or Sisense query language?

No. The server uses natural language processing. You can describe what you want in plain English, and the AI will automatically determine the appropriate chart type, dimensions, and measures.

## Installation and setup

### What are the system requirements?

- Bun 1.0.0 or later (recommended) or Node.js 18.0.0 or later
- Access to a Sisense instance
- A valid Sisense API token
- An MCP client (Cursor, Claude Desktop, etc.)

### How do I install the server?

```bash
# Clone the repository
git clone git@github.com:sisense/sisense-mcp-server.git
cd sisense-mcp-server
# Install dependencies
bun install
# or
npm install
```

### How do I configure the server?

Create a `.env` file in the project root:

```env
SISENSE_URL=https://your-instance.sisense.com
SISENSE_TOKEN=your-api-token-here
# Optional; default is 3001
# PORT=3001
```

### Where do I get a Sisense API token?

1. Log in to your Sisense instance
2. Navigate to your user profile settings
3. Generate an API token
4. Copy the token to your `.env` file

**Note:** Ensure your token has appropriate permissions to access data sources and create charts.

## Usage

### How do I start the server?

```bash
# Development mode
bun run dev
# Production mode
bun run build
bun run start
```

### How do I connect my MCP client?

See the [Quick start](./quickstart.md). For credentials on the URL, tunneling, and feature-flag examples, see [Configuration](./configuration.md).

### What commands can I use?

Once connected, you can use:

- `sisense: get data sources` — List all data sources
- `sisense: get fields for "Data Source Name"` — Get fields for a data source
- `sisense: build chart for "Data Source Name" showing [description]` — Create a chart

### How do I get data sources?

```text
sisense: get data sources
```

You can also phrase this in natural language (for example, "list my Sisense data sources"); your client maps it to the same tool.

### How do I see what fields are available in a data source?

```text
sisense: get fields for "Sample ECommerce"
```

**Important:** Use the exact data source name (case-sensitive) from the list of data sources.

### How do I create a chart?

```text
sisense: build chart for "Sample ECommerce" showing total revenue by month
```

Sisense Intelligence will automatically:

- Determine the appropriate chart type
- Select relevant dimensions and measures
- Create the visualization

### What types of charts can I create?

The server supports various chart types that are automatically selected based on your prompt:

- Line charts (for trends over time)
- Bar/column charts (for comparisons)
- Pie charts (for distributions)
- Area charts (for cumulative data)

### Can I specify the chart type?

Yes. You can specify the chart type in your prompt:

```text
sisense: build chart for "Sample ECommerce" showing revenue by month as a line chart
```

### How do I view the created charts?

When a chart is created, you will receive:

- A `chartId` for reference
- An `imageUrl` pointing to the screenshot

Replace `<PORT>` with your server port (default **3001** unless you set `PORT` in `.env`):

`http://localhost:<PORT>/screenshots/[filename]`

### Can I create multiple charts in one session?

Yes. Each chart is stored in the session state. You can create multiple charts and they will be tracked by their `chartId`.

## Server behavior and feature flags

### Charts open in the MCP App but I want images only (tool mode)

Set **`mcpAppEnabled`** to **`false`** on the MCP URL (query param) or set environment variable **`MCP_APP_ENABLED=false`** on the server process. See [Configuration](./configuration.md#mcp-app-mode).

### How do I enable the query / data tool (`buildQuery`)?

Set **`toolBuildQueryEnabled=true`** on the MCP URL or **`TOOL_BUILD_QUERY_ENABLED=true`** in the server environment. It is off by default. See [Configuration](./configuration.md#query-tool).

### How do I reduce extra narrative text in chart responses?

Set **`toolBuildChartNarrativeEnabled=false`** on the MCP URL or **`TOOL_BUILD_CHART_NARRATIVE_ENABLED=false`** in the server environment. See [Configuration](./configuration.md#chart-narrative).

### Where is the full list of flags and defaults?

See the table under **Optional feature-flag query parameters** in the [repository README](../../README.md).

## Data sources

### What is a data source?

A data source (also called a data model) in Sisense is a collection of tables, dimensions, and measures that you can use to create visualizations.

### How do I find the exact name of a data source?

Use `sisense: get data sources` to see all available data sources with their exact names.

### Why is my data source name not working?

Data source names are case-sensitive. Make sure to use the exact name from the list:

- `"Sample ECommerce"` — correct
- `"sample ecommerce"` — wrong
- `"ECommerce"` — wrong (incomplete)

### Can I use multiple data sources?

Yes, but each chart is created from a single data source. To analyze data across multiple sources, you must create separate charts or use Sisense's data modeling features.

## Chart creation

### How do I write a good chart prompt?

Be specific and clear:

- **Good:** "Show me total revenue by month with trend"
- **Better:** "Show me total revenue by month as a line chart with trend line"
- **Best:** "Display total revenue aggregated by month, sorted chronologically, as a line chart with trend"

### What if my chart does not look right?

Try:

- Being more specific about chart type
- Mentioning the exact field names from `getDataSourceFields`
- Simplifying your prompt
- Checking that the data source has the fields you need

### Can I filter or limit the data?

Yes. Include filters in your prompt:

```text
"Show me the top 10 products by sales"
"Show revenue for the last quarter"
"Display sales from 2024 only"
```

### How long does it take to create a chart?

Chart creation typically takes a few seconds to tens of seconds, depending on data complexity, network speed, and Sisense instance load.

### Can I modify an existing chart?

Currently, you create new charts rather than modifying existing ones. Each chart gets a unique `chartId`. You can create variations by making new chart requests.

### What happens if chart creation fails?

You will receive an error message explaining what went wrong. Common causes:

- Data source not found
- Missing required fields
- Invalid prompt (cannot determine chart type)
- Network or authentication errors

## Troubleshooting

### The server won't start

Check:

1. Environment variables are set in the `.env` file
2. `SISENSE_URL` is correct and accessible
3. `SISENSE_TOKEN` is valid
4. The configured port (default **3001**) is not already in use

### I can't connect to my MCP client

Check:

1. Server is running (`curl http://localhost:3001/health` — use your `PORT` if different)
2. MCP client configuration uses **JSON** `mcpServers` with a streamable HTTP `url` (do not paste shell commands like `bun run dev` into the client config)
3. Firewall isn't blocking the connection
4. Restart your MCP client after the server starts
5. If localhost HTTP never connects from your client or network, use an HTTPS tunnel (for example [ngrok](https://ngrok.com/)) and point the client at `https://.../mcp` — see the tunneling note in [Configuration](./configuration.md).

### The tools do not appear in my client

Try:

1. Restart your MCP client
2. Check server logs for errors
3. Verify MCP client supports streamable HTTP MCP transport to your `/mcp` URL
4. Check that the server is running and accessible

### Chart creation fails

Check:

1. Data source name is exact (case-sensitive)
2. Data source exists and is accessible
3. Your prompt is clear and specific
4. Required fields exist in the data source
5. Server logs for detailed error messages

### Screenshots aren't accessible

Check:

1. Server is running
2. The `__screenshots__` directory exists and is writable
3. Playwright browsers are installed: `bunx playwright install`
4. URL format is correct: `http://localhost:<PORT>/screenshots/[filename]`

### I get authentication errors

Check:

1. API token is valid and not expired
2. Token has proper permissions
3. Sisense URL is correct
4. Network connectivity to your Sisense instance

## Performance

### How many concurrent sessions are supported?

The server supports multiple concurrent sessions. Per-credential state (data-source lists, chart context) is persisted across reconnects — reconnecting with the same credentials reuses existing state rather than starting fresh. Performance depends on:

- Server resources
- Sisense API rate limits
- Network bandwidth

### Does the server cache data?

Sisense API data (data sources, fields) is **not cached** — each tool call queries Sisense directly. Screenshot images served from `/screenshots/` are cached for 24 hours via `Cache-Control: public, max-age=86400`.

### How do I improve performance?

- Use specific prompts to reduce query complexity
- Limit data ranges in your prompts
- Close unused sessions
- Ensure good network connectivity on the machine connected to Sisense

## Limitations

### What are the current limitations?

- Charts are read-only (cannot modify existing charts)
- One data source per chart
- Screenshots are stored locally (not in Sisense)
- No built-in rate limiting
- Session state is in-memory (lost on server restart)

### Can I save charts to Sisense?

Currently, charts are rendered as screenshots and stored locally. To save charts to Sisense, use Sisense's native APIs or UI.

### Can I export chart data?

The server returns chart visualizations (screenshots). To export data, use Sisense's native export features or APIs.

## Best practices

### What are best practices for using the server?

- **Start simple:** Begin with basic queries, then add complexity
- **Use exact names:** Always use exact data source names from the list
- **Be specific:** Clear prompts produce better results
- **Check fields first:** Use `getDataSourceFields` before creating charts
- **Manage sessions:** Close sessions when done to free resources

### How should I structure my workflow?

1. List data sources
2. Get fields for your target data source
3. Create an initial simple chart
4. Refine and create more specific charts
5. Use chart IDs to reference previous charts

## Support

### Where can I get help?

- Check the [repository README](../../README.md) for development commands, security, and the feature-flag reference table
- See the [quick start](./quickstart.md), [Configuration](./configuration.md), and [usage examples](./usage-examples.md)
- Review server logs for detailed error messages

### How do I report issues?

Report issues through your organization's standard channels (for example GitLab issues or support tickets).

### Can I contribute?

Yes. Use the repository’s standard contribution process (for example issues or merge requests on [GitHub](https://github.com/sisense/sisense-mcp-server)); there is no separate contributor document in the README.

## Version information

### What version is this?

Check `package.json` for the current version. The server follows semantic versioning.

### How do I update the version?

Pull the latest changes from the repository and reinstall dependencies:

```bash
git pull
bun install
# or
npm install
```

### What is new in recent versions?

Check the repository's commit history or release notes for changelog information.

---

Copyright © 2026 Sisense Inc. All rights reserved.
