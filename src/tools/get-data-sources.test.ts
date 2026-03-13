import { describe, it, expect, mock } from 'bun:test';
import { getDataSources } from './get-data-sources.js';
import { createMockSessionState } from '@/__test-helpers__/mock-session-state.js';

describe('getDataSources', () => {
  it('returns data sources on success', async () => {
    const sessionState = createMockSessionState();

    const result = await getDataSources({}, sessionState);

    expect(result.isError).toBe(false);
    expect(result.structuredContent.dataSources).toBeArray();
    expect(result.structuredContent.dataSources.length).toBeGreaterThan(0);
  });

  it('content text contains "Available data sources"', async () => {
    const sessionState = createMockSessionState();

    const result = await getDataSources({}, sessionState);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Available data sources');
  });

  it('works with undefined sessionState', async () => {
    const result = await getDataSources({}, undefined);

    expect(result.isError).toBe(false);
    expect(result.structuredContent.dataSources).toBeArray();
  });

  it('returns isError true and empty dataSources when engine throws', async () => {
    const { getDataSourcesEngine } = await import('@sisense/sdk-ai-core');

    (getDataSourcesEngine as ReturnType<typeof mock>).mockImplementationOnce(async () => {
      throw new Error('Connection refused');
    });

    const sessionState = createMockSessionState();
    const result = await getDataSources({}, sessionState);

    expect(result.isError).toBe(true);
    expect(result.structuredContent.dataSources).toEqual([]);
    expect(result.content[0].text).toContain('Failed to get data sources');
    expect(result.content[0].text).toContain('Connection refused');
  });
});
