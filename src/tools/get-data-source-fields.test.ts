import { describe, it, expect, mock } from 'bun:test';
import { getDataSourceFields } from './get-data-source-fields.js';
import { createMockSessionState } from '@/__test-helpers__/mock-session-state.js';
import { MISSING_SISENSE_SESSION_MESSAGE } from '@/utils/sisense-session.js';

describe('getDataSourceFields', () => {
  it('returns fields for a valid dataSourceTitle', async () => {
    const sessionState = createMockSessionState();

    const result = await getDataSourceFields({ dataSourceTitle: 'Sample ECommerce' }, sessionState);

    expect(result.isError).toBe(false);
    expect(result.structuredContent.dataSourceTitle).toBe('Sample ECommerce');
    expect(result.structuredContent.fields).toBeArray();
    expect(result.structuredContent.fields.length).toBeGreaterThan(0);
  });

  it('content text contains "Available data source fields"', async () => {
    const sessionState = createMockSessionState();

    const result = await getDataSourceFields({ dataSourceTitle: 'Sample ECommerce' }, sessionState);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Available data source fields');
  });

  it('returns isError true and empty fields when engine throws', async () => {
    const { getDataSourceFieldsEngine } = await import('@sisense/sdk-ai-core');

    (getDataSourceFieldsEngine as ReturnType<typeof mock>).mockImplementationOnce(async () => {
      throw new Error('Data source not found');
    });

    const sessionState = createMockSessionState();
    const result = await getDataSourceFields({ dataSourceTitle: 'NonExistent' }, sessionState);

    expect(result.isError).toBe(true);
    expect(result.structuredContent.dataSourceTitle).toBe('NonExistent');
    expect(result.structuredContent.fields).toEqual([]);
    expect(result.content[0].text).toContain('Failed to get data source fields');
    expect(result.content[0].text).toContain('Data source not found');
  });

  it('returns isError when session has no httpClient', async () => {
    const result = await getDataSourceFields({ dataSourceTitle: 'Sample ECommerce' }, undefined);

    expect(result.isError).toBe(true);
    expect(result.structuredContent.fields).toEqual([]);
    expect(result.content[0].text).toContain(MISSING_SISENSE_SESSION_MESSAGE);
  });
});
