import type {
  BuildChartContext,
  ChartSummary,
  ExtendedChartWidgetProps,
  QueryResult,
} from '@sisense/sdk-ai-core';
import { z } from 'zod';
import { csdkBrowserMock } from '@/utils/csdk-browser-mock';
import type { SessionState } from '../types/sessions.js';
import {
  getSessionBaseUrl,
  getSessionHttpClient,
  getSessionOpenAIClient,
  getSessionSisenseToken,
  getSessionSisenseUrl,
} from '../utils/sisense-session.js';
import { sanitizeError, generateArtifactId } from '../utils/string-utils.js';
import { getFeatureFlags, type SessionFeatureFlags } from '../utils/feature-flags.js';
import { CustomSuperJSON } from '@sisense/sdk-ui/analytics-composer/node';

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

export function getBuildChartOutputSchema(flags: SessionFeatureFlags) {
  return flags.mcpAppEnabled ? buildChartOutputSchemaAppMode : buildChartOutputSchemaToolMode;
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
  args: { dataSourceTitle: string; userPrompt: string; queryId?: string | null },
  sessionState?: SessionState,
) {
  const { mcpAppEnabled, toolBuildChartNarrativeEnabled } = getFeatureFlags(sessionState);

  try {
    const { dataSourceTitle, userPrompt, queryId } = args;

    const httpClient = getSessionHttpClient(sessionState);
    const openAIClient = getSessionOpenAIClient(sessionState);

    const toolCallId = generateArtifactId('chart');

    const result = await csdkBrowserMock.withBrowserEnvironment(async () => {
      const { buildChartEngine, runWithUserAction } = await import('@sisense/sdk-ai-core');
      const { renderChartWidget } = await import('@/utils/widget-renderer/widget-renderer.js');

      const buildChartContext: BuildChartContext = {
        toolCallId,
        dataSourceTitle,
        chartSummaries: getChartSummaries(sessionState),
        retrieveChart: (id) => (sessionState?.get(id) as ExtendedChartWidgetProps) ?? null,
        saveChart: (id, props) => sessionState?.set(id, props),
        retrieveQuery: (id) => (sessionState?.get(`query-${id}`) as QueryResult) ?? null,
        onInternalQueryResult: (result) => sessionState?.set(`query-${result.queryId}`, result),
        isNlqV3Enabled: true,
        httpClient,
        openAIClient,
        ...(queryId != null && { queryId }),
      };

      // run with user action to collect telemetry and handle consumption quota
      const chartSummary = await runWithUserAction('MCP', 'ASSISTANT', () =>
        buildChartEngine(
          { dataSourceTitle, userPrompt, queryId: queryId ?? undefined },
          buildChartContext,
        ),
      );

      console.info('>>> CHART SUMMARY', chartSummary);

      addChartSummary(sessionState, chartSummary);

      const savedProps = sessionState?.get(chartSummary.chartId) as
        | ExtendedChartWidgetProps
        | undefined;

      if (savedProps) {
        const sisenseUrl = getSessionSisenseUrl(sessionState);
        const sisenseToken = getSessionSisenseToken(sessionState);

        // Run insights API only when narrative enabled; optionally run image render (skip when MCP App mode)
        const { getNlgInsightsFromWidget } = await import('@sisense/sdk-ui/ai');
        const insightsPromise =
          toolBuildChartNarrativeEnabled && httpClient
            ? getNlgInsightsFromWidget(savedProps, httpClient, { verbosity: 'High' })
            : Promise.resolve(undefined as string | undefined);

        const renderPromise = mcpAppEnabled
          ? Promise.resolve(null)
          : renderChartWidget({
              widgetProps: savedProps,
              sisenseUrl,
              sisenseToken,
              baseUrl: getSessionBaseUrl(sessionState),
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
        if (!mcpAppEnabled && renderResult.status === 'fulfilled' && renderResult.value) {
          imageUrl = renderResult.value.content[0]?.text;
        } else if (!mcpAppEnabled && renderResult.status === 'rejected') {
          const sanitized = sanitizeError(renderResult.reason);
          console.warn('Failed to render chart widget:', sanitized.message);
        }

        const serializedWidgetProps = CustomSuperJSON.serialize(savedProps);

        if (mcpAppEnabled && sisenseUrl && sisenseToken) {
          sessionState?.set(`chart:payload:${chartSummary.chartId}`, {
            sisenseUrl,
            sisenseToken,
            serializedWidgetProps,
          });
        }

        return {
          chartSummary,
          imageUrl,
          insights,
          sisenseUrl,
          sisenseToken,
          serializedWidgetProps,
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

    const { chartSummary, imageUrl, insights } = result;

    const output: Record<string, unknown> = {
      success: true,
      chartId: chartSummary.chartId,
      message: chartSummary.message || `Chart created successfully for query: "${userPrompt}"`,
      ...(toolBuildChartNarrativeEnabled && insights != null ? { insights } : {}),
      ...(mcpAppEnabled ? {} : { imageUrl }),
    };

    const finalOutput = {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
      structuredContent: output,
    };

    return finalOutput;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    const output: Record<string, unknown> = {
      success: false,
      chartId: undefined,
      message: `Failed to create chart: ${errorMessage}`,
      ...(toolBuildChartNarrativeEnabled ? { insights: undefined } : {}),
      ...(mcpAppEnabled ? {} : { imageUrl: undefined }),
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
