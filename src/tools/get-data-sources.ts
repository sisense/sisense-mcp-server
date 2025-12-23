import type { GetDataSourcesContext } from '@sisense/sdk-ai-core';
import type { HttpClient } from '@sisense/sdk-rest-client';
import { z } from 'zod';
import type { SessionState } from '../types/sessions.js';

export const getDataSourcesOutputSchema = {
  dataSources: z.array(z.any()),
};

export async function getDataSources(_args: object, sessionState?: SessionState) {
  try {
    const { getDataSourcesEngine } = await import('@sisense/sdk-ai-core');

    const getDataSourcesContext: GetDataSourcesContext = {
      toolCallId: 'get-data-sources',
      httpClient: sessionState?.get('httpClient') as HttpClient | undefined,
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
