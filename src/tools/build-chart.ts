import type {
  BuildChartContext,
  ChartSummary,
  ExtendedChartWidgetProps,
} from '@sisense/sdk-ai-core';
import type { HttpClient } from '@sisense/sdk-rest-client';
import type { RequestId } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { csdkBrowserMock } from '@/utils/csdk-browser-mock';
import type { SessionState } from '../types/sessions.js';
import { sanitizeError } from '../utils/string-utils.js';
import { CustomSuperJSON } from '@sisense/sdk-ui/analytics-composer/node';

const MCP_APP_BUILD_CHART_ENABLED =
  process.env.MCP_APP_BUILD_CHART_ENABLED !== 'false' &&
  process.env.MCP_APP_BUILD_CHART_ENABLED !== '0';

const baseOutputSchema = z.object({
  success: z.boolean(),
  chartId: z.string().optional(),
  insights: z.string().optional(),
  message: z.string(),
});

export const buildChartOutputSchemaAppMode = baseOutputSchema;

export const buildChartOutputSchemaToolMode = baseOutputSchema.extend({
  imageUrl: z.string().optional(),
});

export function getBuildChartOutputSchema() {
  return MCP_APP_BUILD_CHART_ENABLED
    ? buildChartOutputSchemaAppMode
    : buildChartOutputSchemaToolMode;
}

function getChartSummaries(sessionState?: SessionState): ChartSummary[] {
  return (sessionState?.get('chart:summaries') as ChartSummary[]) ?? [];
}

function addChartSummary(sessionState: SessionState | undefined, summary: ChartSummary): void {
  const summaries = getChartSummaries(sessionState);
  summaries.push(summary);
  sessionState?.set('chart:summaries', summaries);
}

export async function buildChart(
  args: { dataSourceTitle: string; userPrompt: string },
  sessionState?: SessionState,
  requestId?: RequestId,
) {
  try {
    const { dataSourceTitle, userPrompt } = args;

    const toolCallId = String(requestId ? `chart-${requestId}` : `chart-${Date.now()}`);

    const result = await csdkBrowserMock.withBrowserEnvironment(async () => {
      const { buildChartEngine } = await import('@sisense/sdk-ai-core');
      const { renderChartWidget } = await import('@/utils/widget-renderer/widget-renderer.js');

      const buildChartContext: BuildChartContext = {
        toolCallId,
        dataSourceTitle,
        chartSummaries: getChartSummaries(sessionState),
        retrieveChart: (id) => (sessionState?.get(id) as ExtendedChartWidgetProps) ?? null,
        saveChart: (id, props) => sessionState?.set(id, props),
        isNlqV3Enabled: true,
        httpClient: sessionState?.get('httpClient') as HttpClient | undefined,
        openAIClient: sessionState?.get('openAIClient') as BuildChartContext['openAIClient'],
      };

      const chartSummary = await buildChartEngine(
        { dataSourceTitle, userPrompt },
        buildChartContext,
      );

      console.info('>>> CHART SUMMARY', chartSummary);

      addChartSummary(sessionState, chartSummary);

      const savedProps = sessionState?.get(chartSummary.chartId) as
        | ExtendedChartWidgetProps
        | undefined;

      if (savedProps) {
        const sisenseUrl = sessionState?.get('sisenseUrl') as string | undefined;
        const sisenseToken = sessionState?.get('sisenseToken') as string | undefined;
        const baseUrl = sessionState?.get('baseUrl') as string | undefined;
        const httpClient = sessionState?.get('httpClient') as HttpClient | undefined;

        if (!sisenseUrl || !sisenseToken) {
          throw new Error(
            'Sisense credentials not found in session. Provide sisenseUrl and sisenseToken as URL params.',
          );
        }

        if (!baseUrl) {
          throw new Error('Base URL not found in session.');
        }

        // Import getNlgInsightsFromWidget dynamically
        const { getNlgInsightsFromWidget } = await import('@sisense/sdk-ui/ai');

        // Always run insights; optionally run image render (skip when MCP App mode - app displays chart)
        const insightsPromise = httpClient
          ? getNlgInsightsFromWidget(savedProps, httpClient, { verbosity: 'High' })
          : Promise.reject(new Error('HttpClient not available for insights generation'));

        const renderPromise = MCP_APP_BUILD_CHART_ENABLED
          ? Promise.resolve(null)
          : renderChartWidget({
              widgetProps: savedProps,
              sisenseUrl,
              sisenseToken,
              baseUrl,
            });

        const [insightsResult, renderResult] = await Promise.allSettled([
          insightsPromise,
          renderPromise,
        ]);

        // Extract insights, handling errors independently
        let insights: string | undefined;
        if (insightsResult.status === 'fulfilled') {
          insights = insightsResult.value;
        } else {
          const sanitized = sanitizeError(insightsResult.reason);
          console.warn('Failed to generate NLG insights:', sanitized.message);
        }

        // Extract imageUrl when render was run (tool mode only)
        let imageUrl: string | undefined;
        if (
          !MCP_APP_BUILD_CHART_ENABLED &&
          renderResult.status === 'fulfilled' &&
          renderResult.value
        ) {
          imageUrl = renderResult.value.content[0]?.text;
        } else if (!MCP_APP_BUILD_CHART_ENABLED && renderResult.status === 'rejected') {
          const sanitized = sanitizeError(renderResult.reason);
          console.warn('Failed to render chart widget:', sanitized.message);
        }

        return {
          chartSummary,
          imageUrl,
          insights,
          sisenseUrl,
          sisenseToken,
          serializedWidgetProps: CustomSuperJSON.serialize(savedProps),
        };
      }

      console.warn('No saved props found for chartId:', chartSummary.chartId);
      return {
        chartSummary,
        imageUrl: undefined,
        insights: undefined,
        sisenseUrl: undefined,
        sisenseToken: undefined,
      };
    });

    const { chartSummary, imageUrl, insights, sisenseUrl, sisenseToken, serializedWidgetProps } =
      result;

    const output: Record<string, unknown> = {
      success: true,
      chartId: chartSummary.chartId,
      message: chartSummary.message || `Chart created successfully for query: "${userPrompt}"`,
      insights,
      ...(MCP_APP_BUILD_CHART_ENABLED ? {} : { imageUrl }),
    };

    const finalOutput = {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
      structuredContent: output,
      _meta: {
        sisenseUrl,
        sisenseToken,
        serializedWidgetProps,
      },
    };

    return finalOutput;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    const output: Record<string, unknown> = {
      success: false,
      chartId: undefined,
      message: `Failed to create chart: ${errorMessage}`,
      insights: undefined,
      ...(MCP_APP_BUILD_CHART_ENABLED ? {} : { imageUrl: undefined }),
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
      structuredContent: output,
      isError: true,
    };
  }
}
