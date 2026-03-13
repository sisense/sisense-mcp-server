import { describe, it, expect } from 'bun:test';
import { csdkBrowserMock } from './csdk-browser-mock.js';

describe('CsdkBrowserMock', () => {
  it('withBrowserEnvironment provides browser context during callback', async () => {
    let windowExisted = false;
    await csdkBrowserMock.withBrowserEnvironment(() => {
      windowExisted = typeof (globalThis as any).window === 'object';
    });

    expect(windowExisted).toBe(true);
  });

  it('withBrowserEnvironment provides window with expected properties', async () => {
    await csdkBrowserMock.withBrowserEnvironment(() => {
      const win = (globalThis as any).window;
      expect(win.document).toBeDefined();
      expect(win.navigator).toBeDefined();
      expect(win.location).toBeDefined();
      expect(win.innerWidth).toBe(1024);
      expect(win.innerHeight).toBe(768);
    });
  });

  it('withBrowserEnvironment provides document with createElement', async () => {
    await csdkBrowserMock.withBrowserEnvironment(() => {
      const doc = (globalThis as any).document;
      const el = doc.createElement('div');
      expect(el.tagName).toBe('DIV');
      expect(el.style).toBeDefined();
      expect(el.classList).toBeDefined();
    });
  });

  it('withBrowserEnvironment provides navigator with userAgent', async () => {
    await csdkBrowserMock.withBrowserEnvironment(() => {
      const nav = (globalThis as any).navigator;
      expect(nav.userAgent).toContain('Node.js');
    });
  });

  it('withBrowserEnvironment provides window.App for CSDK', async () => {
    await csdkBrowserMock.withBrowserEnvironment(() => {
      const win = (globalThis as any).window;
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
      const win = (globalThis as any).window;
      expect(win.fetch).toBeDefined();
      expect(win.Request).toBeDefined();
      expect(win.Response).toBeDefined();
      expect(win.Headers).toBeDefined();
    });
  });

  it('createPersistent and cleanupPersistent work as pair', () => {
    csdkBrowserMock.createPersistent();
    expect(typeof (globalThis as any).window).toBe('object');

    csdkBrowserMock.cleanupPersistent();
    expect((globalThis as any).window).toBeUndefined();

    // Re-create for other tests
    csdkBrowserMock.createPersistent();
  });
});
