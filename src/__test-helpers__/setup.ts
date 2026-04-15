/**
 * Bun test preload file for tests that need SDK mocks.
 * Use with: bun test --preload ./src/__test-helpers__/setup.ts <paths>
 * Registers mock.module() for all Sisense SDK dependencies BEFORE any test code imports them,
 * so unit and mock-based e2e tests can run without a real Sisense instance.
 * Real-SDK e2e tests (e.g. visual-tests) are run without this preload.
 */
export {};
const { mock } = await import('bun:test');
const { z } = await import('zod');
const { csdkBrowserMock } = await import('@/utils/csdk-browser-mock.js');
const { generateArtifactId } = await import('@/utils/string-utils.js');
const { MOCK_CHART_SUMMARY, MOCK_CHART_WIDGET_PROPS, MOCK_NLQ_RESULT, MOCK_QUERY_SUMMARY } =
  await import('./mock-engines.js');

// Set up persistent browser mock so CSDK imports don't fail on `window` checks
csdkBrowserMock.createPersistent();

// --- Mock @sisense/sdk-ai-core ---
mock.module('@sisense/sdk-ai-core', () => ({
  runWithUserAction: <T>(_interfaceName: string, _featureName: string, fn: () => Promise<T>) =>
    fn(),

  TOOL_NAME_BUILD_CHART: 'sisense-build-chart',
  TOOL_NAME_GET_DATA_SOURCES: 'sisense-get-data-sources',
  TOOL_NAME_GET_DATA_SOURCE_FIELDS: 'sisense-get-data-source-fields',
  TOOL_NAME_BUILD_QUERY: 'sisense-build-query',

  getDataSourcesSchema: z.object({}),
  getDataSourceFieldsSchema: z.object({ dataSourceTitle: z.string() }),
  buildChartSchema: z.object({ dataSourceTitle: z.string(), userPrompt: z.string() }),
  buildChartSchemaNaturalConversation: z.object({
    dataSourceTitle: z.string(),
    userPrompt: z.string(),
    queryId: z.string().nullable().optional(),
  }),
  buildQuerySchema: z.object({ dataSourceTitle: z.string(), queryPrompt: z.string() }),

  buildQueryEngine: mock(
    async (
      _args: { dataSourceTitle: string; queryPrompt: string },
      context?: { toolCallId?: string },
    ) => {
      const queryId = context?.toolCallId ?? generateArtifactId('query');
      return {
        queryId,
        title: MOCK_NLQ_RESULT.chartState.title,
        nlqResult: MOCK_NLQ_RESULT,
      };
    },
  ),

  toQuerySummary: (
    result: { queryId: string; title: string; nlqResult: typeof MOCK_NLQ_RESULT },
    includeDataset = true,
  ) => ({
    ...MOCK_QUERY_SUMMARY,
    queryId: result.queryId,
    dataset: includeDataset
      ? result.nlqResult.dataset
      : 'Query executed successfully. Call buildChart with this queryId to visualize the results.',
  }),

  buildChartEngine: mock(
    async (
      args: { dataSourceTitle: string; userPrompt: string },
      context: { saveChart?: (id: string, props: unknown) => void },
    ) => {
      const summary = { ...MOCK_CHART_SUMMARY };
      // Simulate what the real engine does: save props via context
      context.saveChart?.(summary.chartId, { ...MOCK_CHART_WIDGET_PROPS });
      return summary;
    },
  ),

  getDataSourcesEngine: mock(async () => ({
    dataSources: [{ title: 'Sample ECommerce' }, { title: 'Sample Healthcare' }],
    dataSourceTitles: ['Sample ECommerce', 'Sample Healthcare'],
  })),

  getDataSourceFieldsEngine: mock(async (_args: { dataSourceTitle: string }) => ({
    fields: [
      { name: 'Revenue', type: 'numeric' },
      { name: 'Date', type: 'datetime' },
      { name: 'Category', type: 'string' },
    ],
  })),

  createHttpClientFromConfig: mock(() => ({ request: mock(async () => ({})) })),
  createOpenAIClient: mock(() => ({ chat: mock(async () => ({})) })),
  initializeHttpClient: mock(() => {}),
  initializeOpenAIClient: mock(() => {}),
}));

// --- Mock @sisense/sdk-rest-client (type-only in source, but may be resolved) ---
mock.module('@sisense/sdk-rest-client', () => ({}));

// --- Mock @sisense/sdk-ui/ai ---
mock.module('@sisense/sdk-ui/ai', () => ({
  getNlgInsightsFromWidget: mock(
    async () => 'Revenue grew 15% month-over-month with strong Q4 performance.',
  ),
}));

// --- Mock @sisense/sdk-ui/analytics-composer/node ---
mock.module('@sisense/sdk-ui/analytics-composer/node', () => ({
  CustomSuperJSON: {
    serialize: (value: unknown) => ({ json: value, meta: {} }),
    stringify: (value: unknown) => JSON.stringify(value),
  },
}));

// --- Mock widget renderer (Playwright-based, not needed in CI) ---
mock.module('@/utils/widget-renderer/widget-renderer.js', () => ({
  renderChartWidget: mock(async () => ({
    content: [{ type: 'text', text: 'http://localhost:3001/screenshots/mock-chart.png' }],
  })),
}));
