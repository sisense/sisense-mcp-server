import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { buildQuery } from './build-query.js';
import { createMockSessionState } from '@/__test-helpers__/mock-session-state.js';
import { MOCK_NLQ_RESULT } from '@/__test-helpers__/mock-engines.js';
import { MISSING_SISENSE_SESSION_MESSAGE } from '@/utils/sisense-session.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResult = Record<string, any>;

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
});

afterEach(() => {
  process.env = savedEnv;
});

describe('buildQuery - success', () => {
  it('returns success with queryId, title, message, and dataset', async () => {
    const sessionState = createMockSessionState();

    const result: AnyResult = await buildQuery(
      { dataSourceTitle: 'Sample ECommerce', queryPrompt: 'show total revenue by month' },
      sessionState,
    );

    expect(result.structuredContent).toBeDefined();
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.success).toBe(true);
    expect(typeof structured.queryId).toBe('string');
    expect(typeof structured.title).toBe('string');
    expect(typeof structured.message).toBe('string');
    expect(structured.dataset).toBeDefined();
    expect(result.isError).toBeUndefined();
  });

  it('queryId format matches query-XXXXXXXX', async () => {
    const sessionState = createMockSessionState();

    const result: AnyResult = await buildQuery(
      { dataSourceTitle: 'Sample ECommerce', queryPrompt: 'show revenue' },
      sessionState,
    );

    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.queryId).toMatch(/^query-[0-9a-f]{8}$/);
  });

  it('stores QueryResult in session state under query-${queryId}', async () => {
    const sessionState = createMockSessionState();

    const result: AnyResult = await buildQuery(
      { dataSourceTitle: 'Sample ECommerce', queryPrompt: 'show revenue by month' },
      sessionState,
    );

    const structured = result.structuredContent as Record<string, unknown>;
    const queryId = structured.queryId as string;

    const stored = sessionState.get(`query-${queryId}`);
    expect(stored).toBeDefined();
    expect((stored as Record<string, unknown>).queryId).toBe(queryId);
  });

  it('content[0].text is valid JSON matching structuredContent', async () => {
    const sessionState = createMockSessionState();

    const result: AnyResult = await buildQuery(
      { dataSourceTitle: 'Sample ECommerce', queryPrompt: 'show revenue' },
      sessionState,
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.queryId).toBe(result.structuredContent.queryId);
    expect(parsed.title).toBe(result.structuredContent.title);
  });

  it('message includes the queryPrompt', async () => {
    const sessionState = createMockSessionState();
    const queryPrompt = 'show total revenue by month';

    const result: AnyResult = await buildQuery(
      { dataSourceTitle: 'Sample ECommerce', queryPrompt },
      sessionState,
    );

    expect(result.structuredContent.message).toContain(queryPrompt);
  });
});

describe('buildQuery - session state', () => {
  it('stored result contains nlqResult with chartState', async () => {
    const sessionState = createMockSessionState();

    const result: AnyResult = await buildQuery(
      { dataSourceTitle: 'Sample ECommerce', queryPrompt: 'show revenue' },
      sessionState,
    );

    const queryId = result.structuredContent.queryId as string;
    const stored = sessionState.get(`query-${queryId}`) as Record<string, unknown>;

    expect(stored.nlqResult).toBeDefined();
    expect((stored.nlqResult as Record<string, unknown>).chartState).toBeDefined();
  });

  it('multiple calls store separate entries in session state', async () => {
    const sessionState = createMockSessionState();

    const r1: AnyResult = await buildQuery(
      { dataSourceTitle: 'Sample ECommerce', queryPrompt: 'show revenue' },
      sessionState,
    );
    const r2: AnyResult = await buildQuery(
      { dataSourceTitle: 'Sample ECommerce', queryPrompt: 'show orders' },
      sessionState,
    );

    const id1 = r1.structuredContent.queryId as string;
    const id2 = r2.structuredContent.queryId as string;

    expect(id1).not.toBe(id2);
    expect(sessionState.get(`query-${id1}`)).toBeDefined();
    expect(sessionState.get(`query-${id2}`)).toBeDefined();
  });
});

describe('buildQuery - error handling', () => {
  it('returns isError true when buildQueryEngine throws', async () => {
    const { buildQueryEngine } = await import('@sisense/sdk-ai-core');

    (buildQueryEngine as ReturnType<typeof mock>).mockImplementationOnce(async () => {
      throw new Error('errors.responseError');
    });

    const sessionState = createMockSessionState();
    const result: AnyResult = await buildQuery(
      { dataSourceTitle: 'Sample ECommerce', queryPrompt: 'show revenue' },
      sessionState,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.success).toBe(false);
    expect(structured.message).toContain('Failed to execute query');
    expect(structured.message).toContain('errors.responseError');
  });

  it('does not return raw token-like strings in error messages', async () => {
    const { buildQueryEngine } = await import('@sisense/sdk-ai-core');
    const secret = 'abcdefghijklmnopqrstuvwxyz12345678';

    (buildQueryEngine as ReturnType<typeof mock>).mockImplementationOnce(async () => {
      throw new Error(`service error: ${secret}`);
    });

    const result: AnyResult = await buildQuery(
      { dataSourceTitle: 'Sample ECommerce', queryPrompt: 'show revenue' },
      createMockSessionState(),
    );

    const structured = result.structuredContent as Record<string, unknown>;
    expect(String(structured.message)).not.toContain(secret);
    expect(String(structured.message)).toContain('[REDACTED]');
  });

  it('does not store anything in session state when engine throws', async () => {
    const { buildQueryEngine } = await import('@sisense/sdk-ai-core');

    (buildQueryEngine as ReturnType<typeof mock>).mockImplementationOnce(async () => {
      throw new Error('NLQ service unavailable');
    });

    const sessionState = createMockSessionState();
    await buildQuery(
      { dataSourceTitle: 'Sample ECommerce', queryPrompt: 'show revenue' },
      sessionState,
    );

    // No query-* keys should have been set
    const queryKeys = [...sessionState.keys()].filter((k) => String(k).startsWith('query-'));
    expect(queryKeys).toHaveLength(0);
  });

  it('returns error when httpClient is missing from session', async () => {
    const sessionState = createMockSessionState();
    sessionState.delete('httpClient');

    const result: AnyResult = await buildQuery(
      { dataSourceTitle: 'Sample ECommerce', queryPrompt: 'show revenue' },
      sessionState,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.success).toBe(false);
    expect(String(structured.message)).toContain(MISSING_SISENSE_SESSION_MESSAGE);
  });

  it('returns isError when sessionState is undefined', async () => {
    const result: AnyResult = await buildQuery(
      { dataSourceTitle: 'Sample ECommerce', queryPrompt: 'show revenue' },
      undefined,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.success).toBe(false);
    expect(String(structured.message)).toContain(MISSING_SISENSE_SESSION_MESSAGE);
  });
});

describe('buildQuery - dataset passthrough', () => {
  it('dataset in response matches what toQuerySummary returns', async () => {
    const sessionState = createMockSessionState();

    const result: AnyResult = await buildQuery(
      { dataSourceTitle: 'Sample ECommerce', queryPrompt: 'show revenue' },
      sessionState,
    );

    // toQuerySummary(result, true) should include the full dataset
    expect(result.structuredContent.dataset).toEqual(MOCK_NLQ_RESULT.dataset);
  });
});
