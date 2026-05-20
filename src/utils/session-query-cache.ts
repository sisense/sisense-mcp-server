import type { IncomingMessage } from 'node:http';
import type { SessionState } from '../types/sessions.js';

const DEFAULT_QUERY_CACHE_MAX_ENTRIES = 10;

export function getQueryCacheMaxEntries(): number {
  const raw = process.env.MCP_QUERY_CACHE_MAX_ENTRIES?.trim();
  if (!raw) return DEFAULT_QUERY_CACHE_MAX_ENTRIES;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_QUERY_CACHE_MAX_ENTRIES;
}

/** Lists query-* keys in Map insertion order (oldest first). */
export function listQueryCacheKeys(state: SessionState): string[] {
  const keys: string[] = [];
  for (const key of state.keys()) {
    if (typeof key === 'string' && key.startsWith('query-')) {
      keys.push(key);
    }
  }
  return keys;
}

/** Drop oldest query-* keys until at most maxEntries remain. Returns evicted keys. */
export function trimQueryCache(state: SessionState, maxEntries: number): string[] {
  const queryKeys = listQueryCacheKeys(state);
  const evicted: string[] = [];
  while (queryKeys.length > maxEntries) {
    const oldest = queryKeys.shift();
    if (oldest === undefined) break;
    state.delete(oldest);
    evicted.push(oldest);
  }
  return evicted;
}

/** Updates baseUrl from proxy/request headers (screenshot URLs, ngrok, etc.). */
export function refreshSessionBaseUrl(state: SessionState, req: IncomingMessage): void {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  state.set('baseUrl', `${protocol}://${host}`);
}
