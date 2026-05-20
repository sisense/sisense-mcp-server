import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { assertNoError } from './test-utils.js';

const DEFAULT_DATA_SOURCE = 'Sample ECommerce';

export type BuildChartE2EOptions = {
  dataSourceTitle?: string;
  queryPrompt?: string;
  chartPrompt?: string;
};

/**
 * Runs buildQuery then buildChart with queryId so chart creation reuses cached NLQ
 * instead of running a second internal query (which is flaky on real Sisense instances).
 */
export async function callBuildChartWithCachedQuery(
  client: Client,
  options: BuildChartE2EOptions = {},
) {
  const dataSourceTitle = options.dataSourceTitle ?? DEFAULT_DATA_SOURCE;
  const queryPrompt = options.queryPrompt ?? 'Show total revenue by month';
  const chartPrompt = options.chartPrompt ?? 'Show total revenue by month as a column chart';

  const { TOOL_NAME_BUILD_QUERY, TOOL_NAME_BUILD_CHART } = await import('@sisense/sdk-ai-core');

  const queryResult = await client.callTool({
    name: TOOL_NAME_BUILD_QUERY,
    arguments: { dataSourceTitle, queryPrompt },
  });
  assertNoError(queryResult);

  const queryStructured = queryResult.structuredContent as Record<string, unknown>;
  const queryId = queryStructured.queryId as string;
  if (!queryId) {
    throw new Error('buildQuery did not return queryId');
  }

  const chartResult = await client.callTool({
    name: TOOL_NAME_BUILD_CHART,
    arguments: {
      dataSourceTitle,
      userPrompt: chartPrompt,
      queryId,
    },
  });

  return { queryResult, chartResult, queryId };
}
