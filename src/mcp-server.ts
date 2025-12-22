import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { buildChart, buildChartOutputSchema } from './tools/build-chart.js';
import { getDataSources, getDataSourcesOutputSchema } from './tools/get-data-sources.js';
import {
  getDataSourceFields,
  getDataSourceFieldsOutputSchema,
} from './tools/get-data-source-fields.js';
import type { SessionState } from './types/sessions.js';

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

    const server = new McpServer({
      name: 'sisense-mcp-server',
      version: '1.0.0',
    });

    server.registerTool(
      TOOL_NAME_GET_DATA_SOURCES,
      {
        title: 'Get Sisense Data Sources',
        description: 'List all available data sources (or data models) from Sisense.',
        inputSchema: getDataSourcesSchema,
        outputSchema: getDataSourcesOutputSchema,
      },
      async (args) => {
        return await getDataSources(args);
      },
    );

    server.registerTool(
      TOOL_NAME_GET_DATA_SOURCE_FIELDS,
      {
        title: 'Get Sisense Data Source Fields',
        description:
          'List all available fields for a specific data source (or data model) from Sisense.',
        inputSchema: getDataSourceFieldsSchema,
        outputSchema: getDataSourceFieldsOutputSchema,
      },
      async (args) => {
        return await getDataSourceFields(args);
      },
    );

    server.registerTool(
      TOOL_NAME_CHART_BUILDER,
      {
        title: 'Build Sisense Chart from User Prompt',
        description:
          'Build a chart from a Sisense data source using natural language user prompt. Chart type will be automatically determined by Sisense AI based on the user prompt.',
        inputSchema: buildChartSchema,
        outputSchema: buildChartOutputSchema,
      },
      async (args, extra) => {
        return await buildChart(args, sessionState, extra.requestId);
      },
    );

    return server;
  } catch (error) {
    console.error('Error setting up MCP server:', error);
    throw error;
  }
}
