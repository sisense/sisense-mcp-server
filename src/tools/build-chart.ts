import type {
  BuildChartContext,
  ChartSummary,
  ExtendedChartWidgetProps,
} from '@sisense/sdk-ai-core';
import type { RequestId } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { csdkBrowserMock } from '@/utils/csdk-browser-mock';
import type { SessionState } from '../types/sessions.js';

export const buildChartOutputSchema = z.object({
  success: z.boolean(),
  chartId: z.string().optional(),
  imageUrl: z.string().optional(),
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
        const toolResult = await renderChartWidget({ widgetProps: savedProps });
        return { chartSummary, imageUrl: toolResult.content[0]?.text };
      }

      console.warn('No saved props found for chartId:', chartSummary.chartId);
      return { chartSummary, imageUrl: undefined };
    });

    const { chartSummary, imageUrl } = result;

    const output = {
      success: true,
      chartId: chartSummary.chartId,
      message: chartSummary.message || `Chart created successfully for query: "${userPrompt}"`,
      imageUrl,
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
