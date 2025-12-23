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

export const buildChartOutputSchema = z.object({
  success: z.boolean(),
  chartId: z.string().optional(),
  imageUrl: z.string().optional(),
  insights: z.string().optional(),
  message: z.string(),
});

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

    const toolCallId = String(requestId ?? `chart_${Date.now()}`);

    const result = await csdkBrowserMock.withBrowserEnvironment(async () => {
      const { buildChartEngine } = await import('@sisense/sdk-ai-core');
      const { renderChartWidget } = await import('@/utils/widget-renderer/widget-renderer.js');

      const buildChartContext: BuildChartContext = {
        toolCallId,
        dataSourceTitle,
        chartSummaries: getChartSummaries(sessionState),
        retrieveChart: (id) =>
          (sessionState?.get(`chart:${id}`) as ExtendedChartWidgetProps) ?? null,
        saveChart: (id, props) => sessionState?.set(`chart:${id}`, props),
        isNlqV3Enabled: true,
        httpClient: sessionState?.get('httpClient') as HttpClient | undefined,
        openAIClient: sessionState?.get('openAIClient') as BuildChartContext['openAIClient'],
      };

      const chartSummary = await buildChartEngine(
        { dataSourceTitle, userPrompt },
        buildChartContext,
      );

      addChartSummary(sessionState, chartSummary);

      const savedProps = sessionState?.get(`chart:${chartSummary.chartId}`) as
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

        // Run both operations in parallel since they are independent
        const [insightsResult, renderResult] = await Promise.allSettled([
          // Generate NLG insights
          httpClient
            ? getNlgInsightsFromWidget(savedProps, httpClient, { verbosity: 'High' })
            : Promise.reject(new Error('HttpClient not available for insights generation')),
          // Render chart widget
          renderChartWidget({
            widgetProps: savedProps,
            sisenseUrl,
            sisenseToken,
            baseUrl,
          }),
        ]);

        // Extract insights, handling errors independently
        let insights: string | undefined;
        if (insightsResult.status === 'fulfilled') {
          insights = insightsResult.value;
        } else {
          console.warn('Failed to generate NLG insights:', insightsResult.reason);
        }

        // Extract imageUrl, handling errors independently
        let imageUrl: string | undefined;
        if (renderResult.status === 'fulfilled') {
          imageUrl = renderResult.value.content[0]?.text;
        } else {
          console.warn('Failed to render chart widget:', renderResult.reason);
        }

        return { chartSummary, imageUrl, insights };
      }

      console.warn('No saved props found for chartId:', chartSummary.chartId);
      return { chartSummary, imageUrl: undefined, insights: undefined };
    });

    const { chartSummary, imageUrl, insights } = result;

    const output = {
      success: true,
      chartId: chartSummary.chartId,
      message: chartSummary.message || `Chart created successfully for query: "${userPrompt}"`,
      imageUrl,
      insights,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
      structuredContent: output,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    const output = {
      success: false,
      chartId: undefined,
      message: `Failed to create chart: ${errorMessage}`,
      imageUrl: undefined,
      insights: undefined,
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
