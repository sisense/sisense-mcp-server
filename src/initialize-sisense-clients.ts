import { csdkBrowserMock } from './utils/csdk-browser-mock';

/**
 * Initialize browser environment mock for CSDK packages.
 * Sisense credentials are provided per-session via URL params.
 */
export async function initializeSisenseClients(): Promise<void> {
  csdkBrowserMock.createPersistent();
  console.log('Browser environment mock initialized. Sisense auth via per-session URL params.');
}
