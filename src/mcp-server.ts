import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildChart, getBuildChartOutputSchema } from './tools/build-chart.js';
import { getDataSources, getDataSourcesOutputSchema } from './tools/get-data-sources.js';
import {
  getDataSourceFields,
  getDataSourceFieldsOutputSchema,
} from './tools/get-data-source-fields.js';
import { registerPrompts } from './prompts/index.js';
import type { SessionState } from './types/sessions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isSource = import.meta.url.endsWith('.ts');
const DIST_DIR = isSource ? path.join(__dirname, '..', 'dist') : __dirname;

const ANALYTICS_RESOURCE_URI = 'ui://sisense-analytics/view.html';

function isMcpAppEnabled(): boolean {
  return (
    process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED !== 'false' &&
    process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED !== '0'
  );
}

function getCspMeta(sessionState?: SessionState): {
  ui: { csp: { connectDomains: string[]; resourceDomains: string[] } };
} {
  const sisenseUrl =
    (sessionState?.get('sisenseUrl') as string | undefined)?.trim() ??
    process.env.SISENSE_URL?.trim();
  const connectDomains = sisenseUrl ? [sisenseUrl] : [];
  const resourceDomains = sisenseUrl ? [sisenseUrl] : [];
  return {
    ui: {
      csp: {
        connectDomains,
        resourceDomains,
      },
    },
  };
}

// No-op JSON Schema validator to bypass AJV compatibility issues with Bun
// Zod handles all validation internally, so this is safe
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const noOpValidator: any = {
  getValidator: () => (input: unknown) => ({ valid: true, data: input, errorMessage: undefined }),
};

export async function setupMcpServer(sessionState?: SessionState): Promise<McpServer> {
  try {
    const {
      TOOL_NAME_CHART_BUILDER,
      TOOL_NAME_GET_DATA_SOURCE_FIELDS,
      TOOL_NAME_GET_DATA_SOURCES,
      getDataSourcesSchema,
      getDataSourceFieldsSchema,
      buildChartSchema,
    } = await import('@sisense/sdk-ai-core');

    const server = new McpServer(
      {
        name: 'sisense-mcp-server',
        version: '1.0.0',
      },
      {
        jsonSchemaValidator: noOpValidator,
      },
    );

    server.registerTool(
      TOOL_NAME_GET_DATA_SOURCES,
      {
        title: 'Get Sisense Data Sources',
        description: 'List all available data sources (or data models) from Sisense.',
        inputSchema: getDataSourcesSchema.shape,
        outputSchema: getDataSourcesOutputSchema,
      },
      async (args) => {
        return await getDataSources(args, sessionState);
      },
    );

    server.registerTool(
      TOOL_NAME_GET_DATA_SOURCE_FIELDS,
      {
        title: 'Get Sisense Data Source Fields',
        description:
          'List all available fields for a specific data source (or data model) from Sisense.',
        inputSchema: getDataSourceFieldsSchema.shape,
        outputSchema: getDataSourceFieldsOutputSchema,
      },
      async (args) => {
        return await getDataSourceFields(args, sessionState);
      },
    );

    const buildChartOutputSchema = getBuildChartOutputSchema();

    if (isMcpAppEnabled()) {
      registerAppTool(
        server,
        TOOL_NAME_CHART_BUILDER,
        {
          title: 'Build Sisense Chart from User Prompt',
          description:
            'Build a chart from a Sisense data source using natural language user prompt. Chart type will be automatically determined by Sisense AI based on the user prompt.',
          inputSchema: buildChartSchema.shape,
          outputSchema: buildChartOutputSchema.shape,
          _meta: { ui: { resourceUri: ANALYTICS_RESOURCE_URI } },
        },
        async (args, extra) => {
          return await buildChart(args, sessionState, extra.requestId);
        },
      );
    } else {
      server.registerTool(
        TOOL_NAME_CHART_BUILDER,
        {
          title: 'Build Sisense Chart from User Prompt',
          description:
            'Build a chart from a Sisense data source using natural language user prompt. Chart type will be automatically determined by Sisense AI based on the user prompt.',
          inputSchema: buildChartSchema.shape,
          outputSchema: buildChartOutputSchema.shape,
        },
        async (args) => {
          return await buildChart(args, sessionState);
        },
      );
    }

    // Always register the app resource so MCP Apps clients (e.g. basic-host) can connect.
    // When isMcpAppEnabled() is false, buildChart is a normal tool without resourceUri,
    // so this resource is not used for chart display; it just satisfies resources/list.
    registerAppResource(
      server,
      ANALYTICS_RESOURCE_URI,
      ANALYTICS_RESOURCE_URI,
      { mimeType: RESOURCE_MIME_TYPE },
      async (): Promise<ReadResourceResult> => {
        const html = await readFile(path.join(DIST_DIR, 'view.html'), 'utf-8');
        const meta = getCspMeta(sessionState);
        return {
          contents: [
            {
              uri: ANALYTICS_RESOURCE_URI,
              mimeType: RESOURCE_MIME_TYPE,
              text: html,
              _meta: meta,
            },
          ],
        };
      },
    );

    // Register prompts for guided workflows
    registerPrompts(server);

    return server;
  } catch (error) {
    console.error('Error setting up MCP server:', error);
    throw error;
  }
}
