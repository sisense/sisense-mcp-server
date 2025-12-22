import type { GetDataSourceFieldsContext } from '@sisense/sdk-ai-core';
import { z } from 'zod';

export const getDataSourceFieldsOutputSchema = {
  dataSourceTitle: z.string(),
  fields: z.array(z.any()),
};

export async function getDataSourceFields(args: { dataSourceTitle: string }) {
  const { dataSourceTitle } = args;

  try {
    const { getDataSourceFieldsEngine } = await import('@sisense/sdk-ai-core');

    const getDataSourceFieldsContext: GetDataSourceFieldsContext = {
      toolCallId: 'get-data-source-fields',
    };

    // call the data source fields engine
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
