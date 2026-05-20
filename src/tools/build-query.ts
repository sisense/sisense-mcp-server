import { z } from 'zod';
import type { QueryResult } from '@sisense/sdk-ai-core';
import { csdkBrowserMock } from '@/utils/csdk-browser-mock';
import type { SessionState } from '../types/sessions.js';
import { getSessionHttpClient } from '../utils/sisense-session.js';
import {
  sanitizeError,
  generateArtifactId,
  QUERY_ARTIFACT_ID_PATTERN,
} from '../utils/string-utils.js';
import { conversationKeys, devDebug } from '../utils/dev-debug.js';
import { getQueryCacheMaxEntries, trimQueryCache } from '../utils/session-query-cache.js';

export const buildQueryOutputSchema = z.object({
  success: z.boolean(),
  queryId: z
    .string()
    .regex(QUERY_ARTIFACT_ID_PATTERN)
    .optional()
    .describe('Opaque query ID to pass to buildChart (format: query-xxxxxxxx).'),
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

      // Persist result in session state for later retrieval by buildChart (key = queryId, e.g. query-aedce587)
      if (sessionState) {
        sessionState.set(queryResult.queryId, queryResult);
        const evicted = trimQueryCache(sessionState, getQueryCacheMaxEntries());
        devDebug('[mcp-session] buildQuery_stored', {
          queryId: queryResult.queryId,
          lookupKey: queryResult.queryId,
          conversationKeys: conversationKeys(sessionState),
          ...(evicted.length > 0 ? { evicted } : {}),
        });
      }

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
