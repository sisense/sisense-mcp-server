import { initializeSisenseClients } from '@/initialize-sisense-clients.js';

/**
 * Global test setup that runs once before all E2E tests.
 * Initializes Sisense clients required for all tests.
 *
 * IMPORTANT: This must be called BEFORE any imports from @sisense/sdk-ai-core
 * to ensure the browser mock is set up first.
 */
let initialized = false;
let initPromise: Promise<void> | null = null;
let initError: Error | null = null;

export async function setupE2ETests(): Promise<void> {
  if (initError) {
    throw initError;
  }
  if (initialized) {
    return;
  }
  if (initPromise) {
    return initPromise;
  }
  // Wait for module-level initialization to complete
  return initPromise || Promise.resolve();
}

// Initialize immediately when this module is loaded to ensure browser mock
// is set up before any SDK imports happen in other modules
initPromise = initializeSisenseClients()
  .then(() => {
    console.log('Sisense clients initialized for E2E tests (module load)');
    initialized = true;
  })
  .catch((error) => {
    console.error('Failed to initialize Sisense clients in test setup:', error);
    initError = error instanceof Error ? error : new Error(String(error));
  });
