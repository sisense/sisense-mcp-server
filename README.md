# Sisense MCP Server

A Model Context Protocol (MCP) server that provides integration with Sisense analytics platform. This server enables LLMs to interact with Sisense data models and create charts programmatically.

## Features

- **Transport Support**: Streamable SSE (for HTTP-based clients)
- **Three MCP Tools**:
  - `getDataSources`: Retrieve Sisense data sources (or data models)
  - `getDataSourceFields`: List all available fields for a specific data source (or data model) from Sisense
  - `buildChart`: Build charts for a Sisense data source from natural language prompts
- **Authentication**: Token-based authentication via environment variables
- **TypeScript**: Full type safety and modern ESM support
- **Lightweight**: Pure Node.js HTTP server for SSE transport, no heavy frameworks
- **Fast**: Optimized for Bun runtime, also runs on Node.js

## Prerequisites

- **Bun >= 1.0.0** (recommended) or **Node.js >= 18.0.0**
- Sisense instance with API access
- Sisense API token

## Installation

**With Bun (recommended):**

```bash
bun install
```

**With Node.js:**

```bash
npm install
```

## Configuration

Create a `.env` file in the project root:

```bash
SISENSE_URL=https://your-instance.sisense.com
SISENSE_TOKEN=your-api-token-here
PORT=3000  # Optional, for SSE server
```

## Usage

**With Bun:**

```bash
bun run dev
# Or after building:
bun run start
```

**With Node.js:**

```bash
node src/sse-server.ts
# Or after building:
node dist/sse-server.js
```

The SSE server will be available at `http://localhost:3000/mcp`

## Development

**With Bun:**

```bash
# Run in development mode with hot reload
bun run dev

# Run SSE server in development
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

**With Node.js:**

```bash
# Run in development mode
npm run dev

# Run SSE server in development
npm run dev:sse

# Build the project
npm run build

# Run tests
npm test

# Type checking
npm run type-check

# Lint
npm run lint
```
