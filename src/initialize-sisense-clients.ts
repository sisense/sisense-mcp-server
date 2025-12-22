import { type AuthenticatorConfig } from '@sisense/sdk-ai-core';
import { csdkBrowserMock } from './utils/csdk-browser-mock';

import { type SisenseContextProviderProps } from '@sisense/sdk-ui';

let sisenseContextProviderPropsSingleton: SisenseContextProviderProps | null = null;

export function getSisenseContextProviderProps(): SisenseContextProviderProps {
  if (!sisenseContextProviderPropsSingleton) {
    throw new Error('Sisense context provider props not initialized');
  }
  return sisenseContextProviderPropsSingleton;
}

/**
 * Initialize Sisense context provider props
 * For now, only token authentication is supported
 * @param config - Authenticator config
 */
function initializeSisenseContextProviderProps(config: AuthenticatorConfig) {
  sisenseContextProviderPropsSingleton = {
    url: config.url,
    token: config.token,
    showRuntimeErrors: true,
  };
}

/**
 * Initialize clients for consuming Sisense APIs
 * Should be called when the server is started
 */
export async function initializeSisenseClients(): Promise<void> {
  const SISENSE_URL = process.env.SISENSE_URL;
  const SISENSE_TOKEN = process.env.SISENSE_TOKEN;

  if (!SISENSE_URL || !SISENSE_TOKEN) {
    console.error('Error: SISENSE_URL and SISENSE_TOKEN environment variables are required');
    process.exit(1);
  }

  // Create authenticator config for browser environment
  const authConfig: AuthenticatorConfig = {
    url: SISENSE_URL,
    token: SISENSE_TOKEN,
  };

  initializeSisenseContextProviderProps(authConfig);

  // Create persistent browser environment for the server lifetime
  csdkBrowserMock.createPersistent();

  // Dynamic import AFTER browser environment is set up
  const { initializeClients } = await import('@sisense/sdk-ai-core');
  initializeClients(authConfig);

  console.log('Sisense clients initialized with browser environment mock');
}
