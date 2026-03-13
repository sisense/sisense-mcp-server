import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { buildChart } from './build-chart.js';
import { createMockSessionState } from '@/__test-helpers__/mock-session-state.js';
import { MOCK_CHART_ID } from '@/__test-helpers__/mock-engines.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResult = Record<string, any>;

// Save/restore env vars to avoid cross-test pollution
let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
});

afterEach(() => {
  process.env = savedEnv;
});

describe('buildChart - MCP App Mode (default)', () => {
  beforeEach(() => {
    // App mode is default (env var not set or not 'false')
    delete process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED;
    delete process.env.TOOL_CHART_BUILDER_NARRATIVE_ENABLED;
  });

  it('returns success with chartId and message', async () => {
    const sessionState = createMockSessionState();

    const result: AnyResult = await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue by month' },
      sessionState,
    );

    expect(result.structuredContent).toBeDefined();
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.success).toBe(true);
    expect(structured.chartId).toBe(MOCK_CHART_ID);
    expect(typeof structured.message).toBe('string');
  });

  it('does NOT include imageUrl in app mode', async () => {
    const sessionState = createMockSessionState();

    const result: AnyResult = await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue by month' },
      sessionState,
    );

    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured).not.toHaveProperty('imageUrl');
  });

  it('includes _meta with sisenseUrl, sisenseToken, serializedWidgetProps', async () => {
    const sessionState = createMockSessionState();

    const result: AnyResult = await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
    );

    expect(result._meta).toBeDefined();
    const meta = result._meta as Record<string, unknown>;
    expect(meta.sisenseUrl).toBe('https://mock.sisense.com');
    expect(meta.sisenseToken).toBe('mock-token-abc123');
    expect(meta.serializedWidgetProps).toBeDefined();
  });

  it('updates session state with chart summaries', async () => {
    const sessionState = createMockSessionState();

    await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
    );

    const summaries = sessionState.get('chart:summaries') as Array<{
      chartId: string;
      message: string;
    }>;
    expect(summaries).toBeDefined();
    expect(Array.isArray(summaries)).toBe(true);
    expect(summaries.length).toBe(1);
    expect(summaries[0].chartId).toBe(MOCK_CHART_ID);
  });

  it('saves chart props in session state via chartId', async () => {
    const sessionState = createMockSessionState();

    await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
    );

    const savedProps = sessionState.get(MOCK_CHART_ID) as Record<string, unknown>;
    expect(savedProps).toBeDefined();
    expect(savedProps.chartType).toBe('line');
  });

  it('content[0].text is valid JSON', async () => {
    const sessionState = createMockSessionState();

    const result: AnyResult = await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.chartId).toBe(MOCK_CHART_ID);
  });
});

describe('buildChart - Tool Mode', () => {
  beforeEach(() => {
    process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED = 'false';
    delete process.env.TOOL_CHART_BUILDER_NARRATIVE_ENABLED;
  });

  it('returns imageUrl in structuredContent', async () => {
    const sessionState = createMockSessionState();

    const result: AnyResult = await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
    );

    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.success).toBe(true);
    expect(typeof structured.imageUrl).toBe('string');
    expect(structured.imageUrl).toContain('screenshots');
  });

  it('does NOT include _meta in tool mode', async () => {
    const sessionState = createMockSessionState();

    const result: AnyResult = await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
    );

    expect(result._meta).toBeUndefined();
  });

  it('calls renderChartWidget', async () => {
    const { renderChartWidget } = await import('@/utils/widget-renderer/widget-renderer.js');

    const sessionState = createMockSessionState();

    await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
    );

    expect(renderChartWidget).toHaveBeenCalled();
  });
});

describe('buildChart - Narrative behavior', () => {
  beforeEach(() => {
    delete process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED;
  });

  it('includes insights when narrative is enabled (default)', async () => {
    delete process.env.TOOL_CHART_BUILDER_NARRATIVE_ENABLED;
    const sessionState = createMockSessionState();

    const result: AnyResult = await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
    );

    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.insights).toBeDefined();
    expect(typeof structured.insights).toBe('string');
    expect((structured.insights as string).length).toBeGreaterThan(0);
  });

  it('does NOT include insights when TOOL_CHART_BUILDER_NARRATIVE_ENABLED=false', async () => {
    process.env.TOOL_CHART_BUILDER_NARRATIVE_ENABLED = 'false';
    const sessionState = createMockSessionState();

    const result: AnyResult = await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
    );

    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured).not.toHaveProperty('insights');
  });

  it('succeeds even when getNlgInsightsFromWidget rejects', async () => {
    delete process.env.TOOL_CHART_BUILDER_NARRATIVE_ENABLED;
    const { getNlgInsightsFromWidget } = await import('@sisense/sdk-ui/ai');

    (getNlgInsightsFromWidget as ReturnType<typeof mock>).mockImplementationOnce(async () => {
      throw new Error('NLG service unavailable');
    });

    const sessionState = createMockSessionState();
    const result: AnyResult = await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
    );

    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.success).toBe(true);
    // insights may be missing due to failure, but chart should still succeed
    expect(result.isError).toBeUndefined();
  });
});

describe('buildChart - Error handling', () => {
  beforeEach(() => {
    delete process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED;
    delete process.env.TOOL_CHART_BUILDER_NARRATIVE_ENABLED;
  });

  it('returns isError true when buildChartEngine throws', async () => {
    const { buildChartEngine } = await import('@sisense/sdk-ai-core');

    (buildChartEngine as ReturnType<typeof mock>).mockImplementationOnce(async () => {
      throw new Error('AI service unavailable');
    });

    const sessionState = createMockSessionState();
    const result: AnyResult = await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
    );

    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.success).toBe(false);
    expect(result.isError).toBe(true);
    expect(structured.message).toContain('Failed to create chart');
    expect(structured.message).toContain('AI service unavailable');
  });

  it('returns error when session is missing sisenseUrl', async () => {
    const sessionState = createMockSessionState();
    sessionState.delete('sisenseUrl');

    const result: AnyResult = await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.success).toBe(false);
    expect(structured.message).toContain('credentials not found');
  });

  it('returns error when session is missing baseUrl', async () => {
    const sessionState = createMockSessionState();
    sessionState.delete('baseUrl');

    const result: AnyResult = await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.success).toBe(false);
    expect(structured.message).toContain('Base URL not found');
  });

  it('succeeds when renderChartWidget rejects in tool mode', async () => {
    process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED = 'false';
    process.env.TOOL_CHART_BUILDER_NARRATIVE_ENABLED = 'false';
    const { renderChartWidget } = await import('@/utils/widget-renderer/widget-renderer.js');

    (renderChartWidget as ReturnType<typeof mock>).mockImplementationOnce(async () => {
      throw new Error('Playwright crashed');
    });

    const sessionState = createMockSessionState();
    const result: AnyResult = await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
    );

    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.success).toBe(true);
    // imageUrl may be undefined due to render failure, but chart should succeed
    expect(result.isError).toBeUndefined();
  });
});

describe('buildChart - Session state management', () => {
  beforeEach(() => {
    delete process.env.TOOL_CHART_BUILDER_MCP_APP_ENABLED;
    process.env.TOOL_CHART_BUILDER_NARRATIVE_ENABLED = 'false';
  });

  it('multiple calls accumulate in chart:summaries', async () => {
    const sessionState = createMockSessionState();

    await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
    );
    await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show profit' },
      sessionState,
    );

    const summaries = sessionState.get('chart:summaries') as unknown[];
    expect(summaries).toHaveLength(2);
  });

  it('toolCallId uses requestId when provided', async () => {
    const { buildChartEngine } = await import('@sisense/sdk-ai-core');
    let capturedContext: { toolCallId?: string } = {};

    (buildChartEngine as ReturnType<typeof mock>).mockImplementationOnce(
      async (
        args: unknown,
        context: { toolCallId?: string; saveChart?: (id: string, props: unknown) => void },
      ) => {
        capturedContext = context;
        context.saveChart?.('chart-test', { chartType: 'bar', dataSource: 'test' });
        return { chartId: 'chart-test', message: 'Test chart' };
      },
    );

    const sessionState = createMockSessionState();
    await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      sessionState,
      'req-123',
    );

    expect(capturedContext.toolCallId).toBe('chart-req-123');
  });

  it('works with undefined sessionState', async () => {
    const result: AnyResult = await buildChart(
      { dataSourceTitle: 'Sample ECommerce', userPrompt: 'show revenue' },
      undefined,
    );

    // Should still succeed (no saved props, so warns but doesn't crash)
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.success).toBe(true);
  });
});
