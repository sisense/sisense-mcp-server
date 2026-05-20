import type { SessionState } from '../types/sessions.js';

export function devDebug(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug(...args);
  }
}

/** Query/chart keys in session state (for troubleshooting buildQuery → buildChart cache). */
export function conversationKeys(state?: SessionState): string[] {
  if (!state) return [];
  const keys: string[] = [];
  for (const key of state.keys()) {
    if (
      key === 'chart:summaries' ||
      (typeof key === 'string' && (key.startsWith('chart-') || key.startsWith('query-')))
    ) {
      keys.push(String(key));
    }
  }
  return keys.sort();
}

export function mcpRequestLabel(body: unknown): { method?: string; toolName?: string } {
  if (body == null || typeof body !== 'object') return {};
  const record = body as Record<string, unknown>;
  const method = typeof record.method === 'string' ? record.method : undefined;
  let toolName: string | undefined;
  if (method === 'tools/call' && record.params != null && typeof record.params === 'object') {
    const name = (record.params as Record<string, unknown>).name;
    if (typeof name === 'string') toolName = name;
  }
  return { method, toolName };
}
