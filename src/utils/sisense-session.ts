import type { BuildChartContext } from '@sisense/sdk-ai-core';
import type { HttpClient } from '@sisense/sdk-rest-client';
import type { SessionState } from '../types/sessions.js';

export type SessionOpenAIClient = NonNullable<BuildChartContext['openAIClient']>;

/** Used when requiring per-session Sisense clients before calling SDK engines (avoids `httpClient ?? C()` global fallback). */
export const MISSING_SISENSE_SESSION_MESSAGE =
  'Sisense credentials not found in this session. Provide sisenseUrl and sisenseToken as URL query parameters when connecting, or set SISENSE_URL and SISENSE_TOKEN in the server environment.';

export const MISSING_BASE_URL_SESSION_MESSAGE = 'Base URL not found in session.';

export function getSessionHttpClient(sessionState?: SessionState): HttpClient {
  const client = sessionState?.get('httpClient') as HttpClient | undefined;
  if (!client) {
    throw new Error(MISSING_SISENSE_SESSION_MESSAGE);
  }
  return client;
}

export function getSessionOpenAIClient(sessionState?: SessionState): SessionOpenAIClient {
  const client = sessionState?.get('openAIClient') as BuildChartContext['openAIClient'];
  if (!client) {
    throw new Error(MISSING_SISENSE_SESSION_MESSAGE);
  }
  return client;
}

export function getSessionSisenseUrl(sessionState?: SessionState): string {
  const url = sessionState?.get('sisenseUrl') as string | undefined;
  if (!url) {
    throw new Error(MISSING_SISENSE_SESSION_MESSAGE);
  }
  return url;
}

export function getSessionSisenseToken(sessionState?: SessionState): string {
  const token = sessionState?.get('sisenseToken') as string | undefined;
  if (!token) {
    throw new Error(MISSING_SISENSE_SESSION_MESSAGE);
  }
  return token;
}

export function getSessionBaseUrl(sessionState?: SessionState): string {
  const baseUrl = sessionState?.get('baseUrl') as string | undefined;
  if (!baseUrl) {
    throw new Error(MISSING_BASE_URL_SESSION_MESSAGE);
  }
  return baseUrl;
}
