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
import {
  sanitizeError,
  generateArtifactId,
  QUERY_ARTIFACT_ID_PATTERN,
} from '../utils/string-utils.js';
import { getFeatureFlags, type SessionFeatureFlags } from '../utils/feature-flags.js';
import { conversationKeys, devDebug } from '../utils/dev-debug.js';
import { CustomSuperJSON } from '@sisense/sdk-ui/analytics-composer/node';

const baseOutputSchema = z.object({
  success: z.boolean(),
  chartId: z.string().optional(),
  insights: z.string().optional(),
  message: z.string(),
});

export const buildChartOutputSchemaAppMode = baseOutputSchema.extend({
  artifactPayload: z.record(z.unknown()).optional(),
});

export const buildChartOutputSchemaToolMode = baseOutputSchema.extend({
  imageUrl: z.string().optional(),
});

export function getBuildChartOutputSchema(flags: SessionFeatureFlags) {
  return flags.mcpAppEnabled ? buildChartOutputSchemaAppMode : buildChartOutputSchemaToolMode;
}

/** MCP input: opaque query ID from a prior buildQuery call in this session.
 * TEMPORARY FIX UNTIL A FIX IS IN THE SDK-AI-CORE PACKAGE.
 */
export const buildChartQueryIdSchema = z
  .string()
  .regex(
    QUERY_ARTIFACT_ID_PATTERN,
    'Must be the queryId returned by buildQuery (format: query-xxxxxxxx)',
  )
  .optional()
  .describe(
    'Query ID from a prior buildQuery result in this session. Omit to let buildChart run its own query.',
  );

/** Replaces SDK nullable queryId with a typed pattern for MCP tool schemas. */
export function withBuildChartQueryId<T extends z.ZodRawShape>(shape: T) {
  return { ...shape, queryId: buildChartQueryIdSchema };
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

    if (queryId != null) {
      const lookupKey = queryId;
      devDebug('[mcp-session] buildChart_start', {
        queryId,
        lookupKey,
        cacheHit: sessionState?.has(lookupKey) ?? false,
        conversationKeys: conversationKeys(sessionState),
      });
    }

    const result = await csdkBrowserMock.withBrowserEnvironment(async () => {
      const { buildChartEngine, runWithUserAction } = await import('@sisense/sdk-ai-core');
      const { renderChartWidget } = await import('@/utils/widget-renderer/widget-renderer.js');

      const buildChartContext: BuildChartContext = {
        toolCallId,
        dataSourceTitle,
        chartSummaries: getChartSummaries(sessionState),
        retrieveChart: (id) => (sessionState?.get(id) as ExtendedChartWidgetProps) ?? null,
        saveChart: (id, props) => sessionState?.set(id, props),
        retrieveQuery: (id) => {
          const lookupKey = id;
          const hit = (sessionState?.get(lookupKey) as QueryResult) ?? null;
          if (!hit) {
            devDebug('[mcp-session] retrieveQuery_miss', {
              id,
              lookupKey,
              conversationKeys: conversationKeys(sessionState),
            });
          }
          return hit;
        },
        onInternalQueryResult: (result) => sessionState?.set(result.queryId, result),
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

        let artifactPayload: Record<string, unknown> | undefined;
        if (mcpAppEnabled && sisenseUrl && sisenseToken) {
          artifactPayload = { type: 'chart', sisenseUrl, sisenseToken, serializedWidgetProps };
        }

        return { chartSummary, imageUrl, insights, artifactPayload };
      }

      console.warn('No saved props found for chartId:', chartSummary.chartId);
      return {
        chartSummary,
        imageUrl: undefined,
        insights: undefined,
        artifactPayload: undefined,
      };
    });

    const { chartSummary, imageUrl, insights, artifactPayload } = result;

    // LLM-visible text: no credentials, no large serialized props
    const textOutput: Record<string, unknown> = {
      success: true,
      chartId: chartSummary.chartId,
      message: chartSummary.message || `Chart created successfully for query: "${userPrompt}"`,
      ...(toolBuildChartNarrativeEnabled && insights != null ? { insights } : {}),
      ...(mcpAppEnabled ? {} : { imageUrl }),
    };

    // structuredContent adds artifactPayload for the MCP App iframe (never shown to the LLM)
    const structuredOutput: Record<string, unknown> = {
      ...textOutput,
      ...(artifactPayload ? { artifactPayload } : {}),
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(textOutput, null, 2),
        },
      ],
      structuredContent: structuredOutput,
    };
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
