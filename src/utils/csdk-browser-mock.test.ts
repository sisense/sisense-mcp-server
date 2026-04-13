import { describe, it, expect } from 'bun:test';
import { csdkBrowserMock } from './csdk-browser-mock.js';

interface CsdkMockElement {
  tagName: string;
  style: unknown;
  classList: unknown;
}

interface CsdkMockWindow {
  document: {
    createElement: (tag: string) => CsdkMockElement;
  };
  navigator: { userAgent: string };
  location: unknown;
  innerWidth: number;
  innerHeight: number;
  App: {
    user: {
      tenant: unknown;
    };
  };
  fetch?: typeof fetch;
  Request?: unknown;
  Response?: unknown;
  Headers?: unknown;
}

type GlobalWithCsdkMock = typeof globalThis & {
  window?: CsdkMockWindow;
  document?: { createElement: (tag: string) => CsdkMockElement };
  navigator?: { userAgent: string };
};

describe('CsdkBrowserMock', () => {
  it('withBrowserEnvironment provides browser context during callback', async () => {
    let windowExisted = false;
    await csdkBrowserMock.withBrowserEnvironment(() => {
      const g = globalThis as GlobalWithCsdkMock;
      windowExisted = typeof g.window === 'object';
    });

    expect(windowExisted).toBe(true);
  });

  it('withBrowserEnvironment provides window with expected properties', async () => {
    await csdkBrowserMock.withBrowserEnvironment(() => {
      const g = globalThis as GlobalWithCsdkMock;
      const win = g.window!;
      expect(win.document).toBeDefined();
      expect(win.navigator).toBeDefined();
      expect(win.location).toBeDefined();
      expect(win.innerWidth).toBe(1024);
      expect(win.innerHeight).toBe(768);
    });
  });

  it('withBrowserEnvironment provides document with createElement', async () => {
    await csdkBrowserMock.withBrowserEnvironment(() => {
      const g = globalThis as GlobalWithCsdkMock;
      const doc = g.document!;
      const el = doc.createElement('div');
      expect(el.tagName).toBe('DIV');
      expect(el.style).toBeDefined();
      expect(el.classList).toBeDefined();
    });
  });

  it('withBrowserEnvironment provides navigator with userAgent', async () => {
    await csdkBrowserMock.withBrowserEnvironment(() => {
      const g = globalThis as GlobalWithCsdkMock;
      const nav = g.navigator!;
      expect(nav.userAgent).toContain('Node.js');
    });
  });

  it('withBrowserEnvironment provides window.App for CSDK', async () => {
    await csdkBrowserMock.withBrowserEnvironment(() => {
      const g = globalThis as GlobalWithCsdkMock;
      const win = g.window!;
      expect(win.App).toBeDefined();
      expect(win.App.user).toBeDefined();
      expect(win.App.user.tenant).toBeDefined();
    });
  });

  it('withBrowserEnvironment returns callback result', async () => {
    const result = await csdkBrowserMock.withBrowserEnvironment(() => {
      return 42;
    });

    expect(result).toBe(42);
  });

  it('withBrowserEnvironment handles async callbacks', async () => {
    const result = await csdkBrowserMock.withBrowserEnvironment(async () => {
      return 'async-result';
    });

    expect(result).toBe('async-result');
  });

  it('withBrowserEnvironment preserves fetch API', async () => {
    await csdkBrowserMock.withBrowserEnvironment(() => {
      const g = globalThis as GlobalWithCsdkMock;
      const win = g.window!;
      expect(win.fetch).toBeDefined();
      expect(win.Request).toBeDefined();
      expect(win.Response).toBeDefined();
      expect(win.Headers).toBeDefined();
    });
  });

  it('createPersistent and cleanupPersistent work as pair', () => {
    csdkBrowserMock.createPersistent();
    const g = globalThis as GlobalWithCsdkMock;
    expect(typeof g.window).toBe('object');

    csdkBrowserMock.cleanupPersistent();
    expect(g.window).toBeUndefined();

    // Re-create for other tests
    csdkBrowserMock.createPersistent();
  });
});
