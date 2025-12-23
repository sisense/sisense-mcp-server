import type { SessionState } from '@/types/sessions.js';

/**
 * Creates a test session state with httpClient and openAIClient configured.
 * Mirrors the session state setup from sse-server.ts when credentials are provided via URL params.
 */
export async function createTestSessionState(): Promise<SessionState> {
  const state: SessionState = new Map();

  // Read test credentials from environment variables or use mock values
  const sisenseUrl = process.env.SISENSE_URL || 'https://test.sisense.com';
  const sisenseToken = process.env.SISENSE_TOKEN || 'test-token';

  // Set base URL for test environment
  state.set('baseUrl', 'http://localhost:3000');

  // Store credentials for chart rendering
  state.set('sisenseUrl', sisenseUrl);
  state.set('sisenseToken', sisenseToken);

  // Create HTTP client and OpenAI client (same as sse-server.ts)
  const {
    createHttpClientFromConfig,
    createOpenAIClient,
    initializeHttpClient,
    initializeOpenAIClient,
  } = await import('@sisense/sdk-ai-core');
  const httpClient = createHttpClientFromConfig({ url: sisenseUrl, token: sisenseToken });
  // Initialize the httpClient (required before use)
  if (initializeHttpClient) {
    initializeHttpClient(httpClient);
  }
  const openAIClient = createOpenAIClient(httpClient);
  // Initialize the openAIClient (required before use)
  initializeOpenAIClient(openAIClient);
  state.set('httpClient', httpClient);
  state.set('openAIClient', openAIClient);

  return state;
}

/**
 * Checks for error conditions in tool call result and throws if an error is detected.
 * Detects errors via isError flag or by checking for "failed" text in content.
 */
export function assertNoError(result: unknown): void {
  // Check for error conditions - detect isError flag or error text in content
  if (
    typeof result === 'object' &&
    result !== null &&
    'isError' in result &&
    result.isError === true
  ) {
    const errorMessage =
      'content' in result && Array.isArray(result.content) && result.content.length > 0
        ? (result.content[0] as { text?: string }).text || 'Unknown error'
        : 'Error occurred';
    throw new Error(`Tool call failed: ${errorMessage}`);
  }

  // Check content for error messages (even if isError is not set)
  if (
    typeof result === 'object' &&
    result !== null &&
    'content' in result &&
    Array.isArray(result.content) &&
    result.content.length > 0
  ) {
    const firstContent = result.content[0] as { type?: string; text?: string };
    if (firstContent.type === 'text' && typeof firstContent.text === 'string') {
      // Match specific error patterns to avoid false positives
      if (firstContent.text.toLowerCase().startsWith('failed to')) {
        throw new Error(`Tool call failed: ${firstContent.text}`);
      }
    }
  }
}
