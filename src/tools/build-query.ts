import { z } from 'zod';
import type { QueryResult } from '@sisense/sdk-ai-core';
import { csdkBrowserMock } from '@/utils/csdk-browser-mock';
import type { SessionState } from '../types/sessions.js';
import { getSessionHttpClient } from '../utils/sisense-session.js';
import { sanitizeError, generateArtifactId } from '../utils/string-utils.js';

export const buildQueryOutputSchema = z.object({
  success: z.boolean(),
  queryId: z.string().optional(),
  title: z.string().optional(),
  message: z.string(),
  dataset: z.unknown().optional(),
});

export async function buildQuery(
  args: { dataSourceTitle: string; queryPrompt: string },
  sessionState?: SessionState,
) {
  try {
    const { dataSourceTitle, queryPrompt } = args;
    const httpClient = getSessionHttpClient(sessionState);

    const toolCallId = generateArtifactId('query');

    const { queryId, title, dataset } = await csdkBrowserMock.withBrowserEnvironment(async () => {
      const { buildQueryEngine, toQuerySummary, runWithUserAction } =
        await import('@sisense/sdk-ai-core');

      const queryResult: QueryResult = await runWithUserAction('MCP', 'ASSISTANT', () =>
        buildQueryEngine({ dataSourceTitle, queryPrompt }, { toolCallId, httpClient }),
      );

      // Persist result in session state for later retrieval by buildChart
      sessionState?.set(`query-${queryResult.queryId}`, queryResult);

      const summary = toQuerySummary(queryResult, true);
      return { queryId: summary.queryId, title: summary.title, dataset: summary.dataset };
    });

    const output = {
      success: true,
      queryId,
      title,
      message: `Query executed successfully for: "${queryPrompt}"`,
      dataset,
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  } catch (error) {
    const sanitized = sanitizeError(error, true);
    console.error('buildQuery failed:', sanitized.message);
    if (sanitized.stack) {
      console.error(sanitized.stack);
    }

    const output = {
      success: false,
      message: `Failed to execute query: ${sanitized.message}`,
    };
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
      isError: true,
    };
  }
}
