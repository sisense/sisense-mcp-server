import type { SessionState } from '@/types/sessions.js';
import { csdkBrowserMock } from '@/utils/csdk-browser-mock.js';

const WINDOW_UNDEFINED_HINT =
  'Ensure E2E test setup runs first (import e2e/helpers/test-setup.js before other imports) so the browser mock is active. MCP_APP_ENABLED is unrelated to this error.';

/**
 * Creates a test session state with httpClient and openAIClient configured.
 * Mirrors the session state setup from sse-server.ts when credentials are provided via URL params.
 * Runs SDK init inside the browser mock so it works even if the persistent mock was torn down.
 */
export async function createTestSessionState(): Promise<SessionState> {
  const state: SessionState = new Map();

  // Read test credentials from environment variables or use mock values
  const sisenseUrl = process.env.SISENSE_URL || 'https://test.sisense.com';
  const sisenseToken = process.env.SISENSE_TOKEN || 'test-token';

  // Set base URL for test environment
  state.set('baseUrl', 'http://localhost:3001');

  // Store credentials for chart rendering
  state.set('sisenseUrl', sisenseUrl);
  state.set('sisenseToken', sisenseToken);

  try {
    await csdkBrowserMock.withBrowserEnvironment(async () => {
      // Create HTTP client and OpenAI client (same as sse-server.ts)
      const {
        createHttpClientFromConfig,
        createOpenAIClient,
        initializeHttpClient,
        initializeOpenAIClient,
      } = await import('@sisense/sdk-ai-core');
      const httpClient = createHttpClientFromConfig({ url: sisenseUrl, token: sisenseToken });
      if (initializeHttpClient) {
        initializeHttpClient(httpClient);
      }
      const openAIClient = createOpenAIClient(httpClient);
      initializeOpenAIClient(openAIClient);
      state.set('httpClient', httpClient);
      state.set('openAIClient', openAIClient);
    });
  } catch (err) {
    if (err instanceof ReferenceError && /window is not defined/i.test(String(err.message))) {
      throw new Error(`window is not defined during session state init. ${WINDOW_UNDEFINED_HINT}`, {
        cause: err,
      });
    }
    throw err;
  }

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
