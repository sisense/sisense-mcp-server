import type { GetDataSourcesContext } from '@sisense/sdk-ai-core';
import { z } from 'zod';
import type { SessionState } from '../types/sessions.js';
import { getSessionHttpClient } from '../utils/sisense-session.js';

export const getDataSourcesOutputSchema = {
  dataSources: z.array(z.any()),
};

export async function getDataSources(
  _args: object,
  sessionState?: SessionState,
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: { dataSources: unknown[] };
  isError: boolean;
}> {
  try {
    const httpClient = getSessionHttpClient(sessionState);
    const { getDataSourcesEngine } = await import('@sisense/sdk-ai-core');

    const getDataSourcesContext: GetDataSourcesContext = {
      toolCallId: 'get-data-sources',
      httpClient,
    };

    const result = await getDataSourcesEngine({}, getDataSourcesContext);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Available data sources: ${JSON.stringify(result.dataSourceTitles, null, 2)}`,
        },
      ],
      structuredContent: {
        dataSources: result.dataSources,
      },
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: [
        {
          type: 'text' as const,
          text: `Failed to get data sources: ${errorMessage}`,
        },
      ],
      structuredContent: {
        dataSources: [],
      },
      isError: true,
    };
  }
}
