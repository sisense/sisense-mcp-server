/**
 * Creates a mock session state for tests — no real Sisense SDK initialization needed.
 */
import type { SessionState } from '@/types/sessions.js';

export function createMockSessionState(overrides?: Record<string, unknown>): SessionState {
  const state: SessionState = new Map();

  state.set('sisenseUrl', 'https://mock.sisense.com');
  state.set('sisenseToken', 'mock-token-abc123');
  state.set('baseUrl', 'http://localhost:3001');
  state.set('httpClient', { request: async () => ({}) });
  state.set('openAIClient', { chat: async () => ({}) });

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      state.set(key, value);
    }
  }

  return state;
}
