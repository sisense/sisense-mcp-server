import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { sanitizeForDescription, sanitizeForText } from '../utils/string-utils.js';

/**
 * Register all Sisense prompts with the MCP server.
 * Prompts provide guided workflows for common analytics tasks.
 */
export function registerPrompts(server: McpServer) {
  // Prompt 1: Analyze Data Source
  server.registerPrompt(
    'sisense.analyze-data-source',
    {
      title: 'Analyze Data Source',
      description:
        'A guided workflow for exploring and analyzing a Sisense data source. Helps identify available fields, suggest visualizations, and create initial charts.',
      argsSchema: {
        dataSourceTitle: z.string().describe('The title of the data source to analyze'),
        topic: z
          .string()
          .optional()
          .describe('Optional business topic to focus the analysis on (e.g., "revenue trends")'),
      },
    },
    async (args) => {
      const { dataSourceTitle, topic } = args;

      // Sanitize user inputs to prevent injection attacks and format breaking
      const sanitizedDataSourceTitle = sanitizeForDescription(dataSourceTitle);
      const sanitizedTopic = topic ? sanitizeForText(topic) : undefined;
      const topicContext = sanitizedTopic
        ? `\n\nThe user is specifically interested in: "${sanitizedTopic}"`
        : '';

      return {
        description: `Guided analysis of data source "${sanitizedDataSourceTitle}"`,
        messages: [
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: `I'll help you analyze the "${sanitizedDataSourceTitle}" data source. This workflow will:\n\n1. **Explore the data structure** - Identify available tables and fields\n2. **Understand your data** - Find key metrics and dimensions\n3. **Generate insights** - Create relevant visualizations${topicContext}\n\nLet me start by examining the available fields in this data source.`,
            },
          },
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: `To complete this analysis, I'll use these tools in sequence:\n\n1. **getDataSourceFields** with dataSourceTitle: "${sanitizedDataSourceTitle}" to understand the data structure\n2. **buildChart** to create visualizations based on the available fields\n\nThis will give you a comprehensive view of your data and help identify key business insights.`,
            },
          },
        ],
      };
    },
  );

  // Prompt 2: Executive KPI Inquiry
  server.registerPrompt(
    'sisense.executive-kpi-inquiry',
    {
      title: 'Executive KPI Inquiry',
      description:
        'Handle natural language questions about business KPIs with executive-friendly insights. Translates business questions into data queries and visualizations.',
      argsSchema: {
        query: z
          .string()
          .describe(
            'Natural language KPI question (e.g., "How is our revenue performing this quarter?")',
          ),
        dataSourceTitle: z.string().describe('The data source to query for KPI data'),
        timeframe: z
          .string()
          .optional()
          .describe('Analysis timeframe (e.g., "this quarter", "YTD", "last 30 days")'),
      },
    },
    async (args) => {
      const { query, dataSourceTitle, timeframe } = args;

      // Sanitize user inputs to prevent injection attacks and format breaking
      const sanitizedQuery = sanitizeForDescription(query);
      const sanitizedDataSourceTitle = sanitizeForText(dataSourceTitle);
      const sanitizedTimeframe = timeframe ? sanitizeForText(timeframe) : undefined;
      const timeContext = sanitizedTimeframe ? ` for ${sanitizedTimeframe}` : '';

      // Parse the query for intent (use original query for parsing, but sanitized for display)
      const intent = parseQueryIntent(query);

      return {
        description: `Executive KPI analysis: "${sanitizedQuery}"`,
        messages: [
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: `I'll help you understand your business performance with the query: "${sanitizedQuery}"\n\nBased on your question, I've identified:\n• **Analysis Type**: ${intent.type}\n• **Key Metrics**: ${intent.metrics.join(', ') || 'To be determined from data'}\n• **Timeframe**: ${sanitizedTimeframe || 'Current period'}\n• **Data Source**: ${sanitizedDataSourceTitle}`,
            },
          },
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: `To provide comprehensive insights, I'll:\n\n1. **Explore the data source** - Use getDataSourceFields to understand available metrics\n2. **Create visualizations** - Use buildChart with your query: "${sanitizedQuery}${timeContext}"\n3. **Provide executive summary** - Explain findings in business terms\n\nThis will give you actionable insights for strategic decision-making.`,
            },
          },
        ],
      };
    },
  );

  // Prompt 3: Create Dashboard Report
  server.registerPrompt(
    'sisense.create-dashboard-report',
    {
      title: 'Create Dashboard Report',
      description:
        'Generate a multi-chart dashboard report for a specific business topic. Creates complementary visualizations that tell a complete data story.',
      argsSchema: {
        dataSourceTitle: z.string().describe('The data source to use for the report'),
        reportTopic: z
          .string()
          .describe(
            'The business topic for the report (e.g., "Sales Performance", "Customer Analytics")',
          ),
        chartCount: z.number().optional().describe('Number of charts to generate (default: 3)'),
      },
    },
    async (args) => {
      const { dataSourceTitle, reportTopic, chartCount = 3 } = args;

      // Sanitize user inputs to prevent injection attacks and format breaking
      const sanitizedDataSourceTitle = sanitizeForText(dataSourceTitle);
      const sanitizedReportTopic = sanitizeForDescription(reportTopic);

      return {
        description: `Dashboard report for "${sanitizedReportTopic}"`,
        messages: [
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: `I'll create a comprehensive dashboard report on "${sanitizedReportTopic}" using the "${sanitizedDataSourceTitle}" data source.\n\nThis report will include ${chartCount} complementary visualizations that:\n• Provide an executive overview\n• Show trends and patterns\n• Highlight key metrics and KPIs\n• Enable data-driven decision making`,
            },
          },
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: `**Report Generation Strategy:**\n\n1. **Understand the data** - First, I'll use getDataSourceFields to identify relevant metrics and dimensions for "${sanitizedReportTopic}"\n\n2. **Create visualizations** - I'll generate ${chartCount} charts using buildChart:\n   • Overview chart (summary metrics)\n   • Trend chart (time-based analysis)\n   • Breakdown chart (categorical comparison)\n\n3. **Compile the report** - Present all visualizations with insights\n\nLet me start by exploring the available data.`,
            },
          },
        ],
      };
    },
  );

  // Prompt 4: Compare Metrics
  server.registerPrompt(
    'sisense.compare-metrics',
    {
      title: 'Compare Metrics',
      description:
        'Compare two or more metrics or dimensions to identify relationships, correlations, and insights.',
      argsSchema: {
        dataSourceTitle: z.string().describe('The data source containing the metrics'),
        metrics: z
          .string()
          .describe('Comma-separated list of metrics to compare (e.g., "revenue, costs, profit")'),
        groupBy: z
          .string()
          .optional()
          .describe('Optional dimension to group the comparison by (e.g., "region", "product")'),
      },
    },
    async (args) => {
      const { dataSourceTitle, metrics, groupBy } = args;

      // Sanitize user inputs to prevent injection attacks and format breaking
      const sanitizedDataSourceTitle = sanitizeForText(dataSourceTitle);
      const sanitizedMetrics = sanitizeForDescription(metrics);
      const sanitizedGroupBy = groupBy ? sanitizeForText(groupBy) : undefined;

      // Split and sanitize each metric individually
      const metricsList = sanitizedMetrics
        .split(',')
        .map((m) => sanitizeForText(m.trim()))
        .filter((m) => m.length > 0);
      const groupContext = sanitizedGroupBy ? ` grouped by ${sanitizedGroupBy}` : '';

      return {
        description: `Metric comparison: ${sanitizedMetrics}`,
        messages: [
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: `I'll compare the following metrics from "${sanitizedDataSourceTitle}"${groupContext}:\n\n${metricsList.map((m) => `• ${m}`).join('\n')}\n\nThis analysis will help identify:\n• Relationships between metrics\n• Performance patterns\n• Areas requiring attention`,
            },
          },
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: `**Comparison Approach:**\n\n1. **Verify metrics exist** - Use getDataSourceFields to confirm the metrics are available\n\n2. **Generate comparison chart** - Use buildChart with a query like:\n   "Compare ${sanitizedMetrics}${groupContext}"\n\n3. **Analyze results** - Interpret the visualization and provide insights\n\nI'll create visualizations that best represent the comparison between these metrics.`,
            },
          },
        ],
      };
    },
  );
}

/**
 * Parse a natural language query to determine intent and extract key information
 */
function parseQueryIntent(query: string): { type: string; metrics: string[] } {
  const lowerQuery = query.toLowerCase();

  // Determine analysis type
  let type = 'Performance Analysis';
  if (
    lowerQuery.includes('trend') ||
    lowerQuery.includes('over time') ||
    lowerQuery.includes('growth')
  ) {
    type = 'Trend Analysis';
  } else if (
    lowerQuery.includes('compare') ||
    lowerQuery.includes('vs') ||
    lowerQuery.includes('versus')
  ) {
    type = 'Comparison Analysis';
  } else if (lowerQuery.includes('breakdown') || lowerQuery.includes('by')) {
    type = 'Breakdown Analysis';
  }

  // Extract common metric terms
  const metrics: string[] = [];
  const commonMetrics = [
    'revenue',
    'sales',
    'profit',
    'margin',
    'cost',
    'customers',
    'orders',
    'units',
    'conversion',
    'retention',
  ];
  for (const metric of commonMetrics) {
    if (lowerQuery.includes(metric)) {
      metrics.push(metric);
    }
  }

  return { type, metrics };
}
