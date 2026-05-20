import { describe, expect, it, afterEach } from 'bun:test';
import type { IncomingMessage } from 'node:http';
import type { SessionState } from '../types/sessions.js';
import {
  getQueryCacheMaxEntries,
  listQueryCacheKeys,
  refreshSessionBaseUrl,
  trimQueryCache,
} from './session-query-cache.js';

describe('getQueryCacheMaxEntries', () => {
  const original = process.env.MCP_QUERY_CACHE_MAX_ENTRIES;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.MCP_QUERY_CACHE_MAX_ENTRIES;
    } else {
      process.env.MCP_QUERY_CACHE_MAX_ENTRIES = original;
    }
  });

  it('defaults to 10 when unset', () => {
    delete process.env.MCP_QUERY_CACHE_MAX_ENTRIES;
    expect(getQueryCacheMaxEntries()).toBe(10);
  });

  it('parses valid env value', () => {
    process.env.MCP_QUERY_CACHE_MAX_ENTRIES = '5';
    expect(getQueryCacheMaxEntries()).toBe(5);
  });

  it('falls back to default for invalid env value', () => {
    process.env.MCP_QUERY_CACHE_MAX_ENTRIES = 'abc';
    expect(getQueryCacheMaxEntries()).toBe(10);
  });
});

describe('trimQueryCache', () => {
  it('evicts oldest query keys when over max', () => {
    const state: SessionState = new Map();
    for (let i = 0; i < 11; i++) {
      state.set(`query-${i.toString().padStart(8, '0')}`, { queryId: `query-${i}` });
    }

    const evicted = trimQueryCache(state, 10);

    expect(evicted).toHaveLength(1);
    expect(evicted[0]).toBe('query-00000000');
    expect(listQueryCacheKeys(state)).toHaveLength(10);
    expect(state.has('query-00000000')).toBe(false);
    expect(state.has('query-00000010')).toBe(true);
  });

  it('does not evict when at or under max', () => {
    const state: SessionState = new Map();
    state.set('query-abc12345', {});
    expect(trimQueryCache(state, 10)).toEqual([]);
    expect(listQueryCacheKeys(state)).toEqual(['query-abc12345']);
  });
});

describe('refreshSessionBaseUrl', () => {
  it('sets baseUrl from forwarded headers', () => {
    const state: SessionState = new Map();
    const req = {
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'tunnel.example.com',
      },
    } as unknown as IncomingMessage;

    refreshSessionBaseUrl(state, req);

    expect(state.get('baseUrl')).toBe('https://tunnel.example.com');
  });

  it('preserves existing query keys', () => {
    const state: SessionState = new Map();
    state.set('query-abc12345', { queryId: 'query-abc12345' });

    refreshSessionBaseUrl(state, {
      headers: { host: 'localhost:3001' },
    } as unknown as IncomingMessage);

    expect(state.has('query-abc12345')).toBe(true);
  });
});
