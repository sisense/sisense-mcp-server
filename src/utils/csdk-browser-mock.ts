/**
 * Simple browser environment mock specifically for CSDK compatibility
 * Creates minimal browser APIs needed for @sisense/sdk-ui and @sisense/sdk-ai-core to work in Node.js
 */
class CsdkBrowserMock {
  private originalGlobals: Map<string, unknown> = new Map();
  private isActive = false;

  /**
   * Creates a minimal browser environment for CSDK SDK
   */
  private create(): void {
    if (this.isActive || typeof window !== 'undefined') {
      return; // Already exists or already active
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalScope = global as any;

    // Create minimal DOM objects for CSDK
    const mockElement = this.createMockElement();
    const mockDocument = this.createMockDocument(mockElement);
    const mockWindow = this.createMockWindow(mockDocument);

    // Set globals with backup for cleanup
    this.setGlobal(globalScope, 'window', mockWindow);
    this.setGlobal(globalScope, 'document', mockDocument);
    this.setGlobal(globalScope, 'self', mockWindow);
    // DON'T override globalThis as it breaks Node's fetch

    // Ensure fetch API is available globally (preserve Node's native implementation)
    if (!globalScope.fetch && global.fetch) {
      this.setGlobal(globalScope, 'fetch', global.fetch);
      this.setGlobal(globalScope, 'Request', global.Request);
      this.setGlobal(globalScope, 'Response', global.Response);
      this.setGlobal(globalScope, 'Headers', global.Headers);
      this.setGlobal(globalScope, 'AbortController', global.AbortController);
      this.setGlobal(globalScope, 'AbortSignal', global.AbortSignal);
    }

    // Set navigator with special handling for read-only property
    this.setNavigator(globalScope, mockWindow.navigator);

    this.isActive = true;
    console.debug('CSDK browser environment mock created');
  }

  /**
   * Cleans up the browser environment mock
   */
  private cleanup(): void {
    if (!this.isActive) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalScope = global as any;

    // Restore original globals or delete if they didn't exist
    this.originalGlobals.forEach((originalValue, key) => {
      if (originalValue === undefined) {
        delete globalScope[key];
      } else {
        globalScope[key] = originalValue;
      }
    });

    this.originalGlobals.clear();
    this.isActive = false;
    console.debug('CSDK browser environment mock cleaned up');
  }

  /**
   * Executes a function within a browser environment context
   * @param fn - The function to execute within the browser context
   * @returns Promise resolving to the function's return value
   */
  async withBrowserEnvironment<T>(fn: () => T | Promise<T>): Promise<T> {
    this.create();
    try {
      return await fn();
    } finally {
      this.cleanup();
    }
  }

  /**
   * Creates browser environment that persists until explicitly cleaned up
   * Useful for server environments where CSDK is used throughout the process
   */
  createPersistent(): void {
    this.create();
  }

  /**
   * Cleans up persistent browser environment
   */
  cleanupPersistent(): void {
    this.cleanup();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private setGlobal(globalScope: any, key: string, value: unknown): void {
    // Backup original value for cleanup
    this.originalGlobals.set(key, globalScope[key]);
    globalScope[key] = value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private setNavigator(globalScope: any, navigator: unknown): void {
    try {
      Object.defineProperty(globalScope, 'navigator', {
        value: navigator,
        writable: true,
        configurable: true,
      });
      this.originalGlobals.set('navigator', undefined); // Mark for cleanup
    } catch (error) {
      console.warn('Could not set global navigator property', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private createMockElement() {
    return (tagName = 'div') => ({
      tagName: tagName.toUpperCase(),
      style: {},
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false,
        toggle: () => false,
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      querySelector: () => null,
      querySelectorAll: () => [],
      setAttribute: () => {},
      getAttribute: () => null,
      removeAttribute: () => {},
      appendChild: () => {},
      removeChild: () => {},
      innerHTML: '',
      textContent: '',
    });
  }

  private createMockDocument(mockElement: ReturnType<typeof this.createMockElement>) {
    return {
      createElement: mockElement,
      createTextNode: (text: string) => ({
        textContent: text,
        nodeValue: text,
      }),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementsByTagName: () => [],
      getElementsByClassName: () => [],
      body: mockElement('body'),
      head: mockElement('head'),
      documentElement: mockElement('html'),
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    };
  }

  private createMockWindow(mockDocument: ReturnType<typeof this.createMockDocument>) {
    return {
      document: mockDocument,
      navigator: {
        userAgent: 'Node.js/CSDK-server',
        platform: 'server',
        appName: 'Node.js',
        appVersion: '1.0',
        language: 'en-US',
        languages: ['en-US'],
        onLine: true,
      },
      location: {
        href: 'http://localhost',
        protocol: 'http:',
        host: 'localhost',
        hostname: 'localhost',
        port: '',
        pathname: '/',
        search: '',
        hash: '',
        origin: 'http://localhost',
      },
      // Add window.App structure required by @sisense/sdk-ai-core
      App: {
        proxyurl: '',
        user: {
          tenant: {
            tenantDomainNames: [],
            name: '',
          },
        },
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      getComputedStyle: () => ({
        getPropertyValue: () => '',
        setProperty: () => {},
      }),
      requestAnimationFrame: (callback: () => void) => setTimeout(callback, 16),
      cancelAnimationFrame: (id: number) => clearTimeout(id),
      innerWidth: 1024,
      innerHeight: 768,
      outerWidth: 1024,
      outerHeight: 768,
      screen: {
        width: 1024,
        height: 768,
        availWidth: 1024,
        availHeight: 768,
      },
      console: console,
      setTimeout: global.setTimeout,
      clearTimeout: global.clearTimeout,
      setInterval: global.setInterval,
      clearInterval: global.clearInterval,
      // Include Node.js native fetch API
      fetch: global.fetch,
      Request: global.Request,
      Response: global.Response,
      Headers: global.Headers,
      AbortController: global.AbortController,
      AbortSignal: global.AbortSignal,
    };
  }
}

/**
 * Browser environment mock instance for CSDK APIs
 */
export const csdkBrowserMock = new CsdkBrowserMock();
