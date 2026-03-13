/**
 * Canonical mock return values for Sisense SDK engines.
 * Used by both the preload setup and individual test files.
 */

export const MOCK_CHART_ID = 'chart-mock-12345';

export const MOCK_CHART_SUMMARY = {
  chartId: MOCK_CHART_ID,
  message: 'Created a line chart showing total revenue by month with trend analysis.',
};

export const MOCK_CHART_WIDGET_PROPS = {
  chartType: 'line',
  dataSource: 'Sample ECommerce',
  dataOptions: {
    category: [{ name: 'Date', type: 'datetime' }],
    value: [{ name: 'Revenue', aggregation: 'sum' }],
  },
};

export const MOCK_DATA_SOURCES = {
  dataSources: [{ title: 'Sample ECommerce' }, { title: 'Sample Healthcare' }],
  dataSourceTitles: ['Sample ECommerce', 'Sample Healthcare'],
};

export const MOCK_DATA_SOURCE_FIELDS = {
  fields: [
    { name: 'Revenue', type: 'numeric' },
    { name: 'Date', type: 'datetime' },
    { name: 'Category', type: 'string' },
  ],
};

export const MOCK_NLG_INSIGHTS = 'Revenue grew 15% month-over-month with strong Q4 performance.';
