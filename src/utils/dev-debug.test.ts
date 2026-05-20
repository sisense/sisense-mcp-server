import { describe, expect, it, afterEach } from 'bun:test';
import { conversationKeys, devDebug, mcpRequestLabel } from './dev-debug.js';
import type { SessionState } from '../types/sessions.js';

describe('devDebug', () => {
  const originalEnv = process.env.NODE_ENV;
  let debugCalls: unknown[][];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('does not log when NODE_ENV is not development', () => {
    debugCalls = [];
    const originalDebug = console.debug;
    console.debug = (...args: unknown[]) => {
      debugCalls.push(args);
    };

    process.env.NODE_ENV = 'production';
    devDebug('test');
    console.debug = originalDebug;

    expect(debugCalls.length).toBe(0);
  });

  it('logs when NODE_ENV is development', () => {
    debugCalls = [];
    const originalDebug = console.debug;
    console.debug = (...args: unknown[]) => {
      debugCalls.push(args);
    };

    process.env.NODE_ENV = 'development';
    devDebug('hello', { foo: 'bar' });
    console.debug = originalDebug;

    expect(debugCalls.length).toBe(1);
    expect(debugCalls[0]).toEqual(['hello', { foo: 'bar' }]);
  });
});

describe('conversationKeys', () => {
  it('lists query and chart keys only', () => {
    const state: SessionState = new Map();
    state.set('sisenseUrl', 'https://example.com');
    state.set('query-abc12345', {});
    state.set('chart:summaries', []);
    expect(conversationKeys(state)).toEqual(['chart:summaries', 'query-abc12345']);
  });
});

describe('mcpRequestLabel', () => {
  it('extracts tools/call name', () => {
    expect(
      mcpRequestLabel({ method: 'tools/call', params: { name: 'sisense-build-query' } }),
    ).toEqual({ method: 'tools/call', toolName: 'sisense-build-query' });
  });
});
