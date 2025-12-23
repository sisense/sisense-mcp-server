import type { GetDataSourceFieldsContext } from '@sisense/sdk-ai-core';
import type { HttpClient } from '@sisense/sdk-rest-client';
import { z } from 'zod';
import type { SessionState } from '../types/sessions.js';

export const getDataSourceFieldsOutputSchema = {
  dataSourceTitle: z.string(),
  fields: z.array(z.any()),
};

export async function getDataSourceFields(
  args: { dataSourceTitle: string },
  sessionState?: SessionState,
) {
  const { dataSourceTitle } = args;

  try {
    const { getDataSourceFieldsEngine } = await import('@sisense/sdk-ai-core');

    const getDataSourceFieldsContext: GetDataSourceFieldsContext = {
      toolCallId: 'get-data-source-fields',
      httpClient: sessionState?.get('httpClient') as HttpClient | undefined,
    };

    const result = await getDataSourceFieldsEngine({ dataSourceTitle }, getDataSourceFieldsContext);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Available data source fields: ${JSON.stringify(result.fields, null, 2)}`,
        },
      ],
      structuredContent: {
        dataSourceTitle: dataSourceTitle,
        fields: result.fields,
      },
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: [
        {
          type: 'text' as const,
          text: `Failed to get data source fields: ${errorMessage}`,
        },
      ],
      structuredContent: {
        dataSourceTitle: dataSourceTitle,
        fields: [],
      },
      isError: true,
    };
  }
}
