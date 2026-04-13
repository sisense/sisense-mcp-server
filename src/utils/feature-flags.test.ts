import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  resolveFeatureFlagsFromEnv,
  resolveFeatureFlagsFromUrl,
  applyFeatureFlagsToSession,
  getFeatureFlags,
} from './feature-flags.js';

// Save and restore env vars around each test
const ENV_KEYS = [
  'MCP_APP_ENABLED',
  'TOOL_BUILD_QUERY_ENABLED',
  'TOOL_BUILD_CHART_NARRATIVE_ENABLED',
] as const;

let savedEnv: Partial<Record<string, string>>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

// ─── resolveFeatureFlagsFromEnv ───────────────────────────────────────────────

describe('resolveFeatureFlagsFromEnv', () => {
  it('returns opt-out defaults when env vars are unset', () => {
    const flags = resolveFeatureFlagsFromEnv();
    expect(flags.mcpAppEnabled).toBe(true);
    expect(flags.toolBuildQueryEnabled).toBe(false);
    expect(flags.toolBuildChartNarrativeEnabled).toBe(true);
  });

  it('disables mcpAppEnabled when MCP_APP_ENABLED=false', () => {
    process.env.MCP_APP_ENABLED = 'false';
    expect(resolveFeatureFlagsFromEnv().mcpAppEnabled).toBe(false);
  });

  it('disables mcpAppEnabled when MCP_APP_ENABLED=0', () => {
    process.env.MCP_APP_ENABLED = '0';
    expect(resolveFeatureFlagsFromEnv().mcpAppEnabled).toBe(false);
  });

  it('keeps mcpAppEnabled enabled when MCP_APP_ENABLED=true', () => {
    process.env.MCP_APP_ENABLED = 'true';
    expect(resolveFeatureFlagsFromEnv().mcpAppEnabled).toBe(true);
  });

  it('enables toolBuildQueryEnabled when TOOL_BUILD_QUERY_ENABLED=true', () => {
    process.env.TOOL_BUILD_QUERY_ENABLED = 'true';
    expect(resolveFeatureFlagsFromEnv().toolBuildQueryEnabled).toBe(true);
  });

  it('enables toolBuildQueryEnabled when TOOL_BUILD_QUERY_ENABLED=1', () => {
    process.env.TOOL_BUILD_QUERY_ENABLED = '1';
    expect(resolveFeatureFlagsFromEnv().toolBuildQueryEnabled).toBe(true);
  });

  it('keeps toolBuildQueryEnabled disabled when TOOL_BUILD_QUERY_ENABLED=false', () => {
    process.env.TOOL_BUILD_QUERY_ENABLED = 'false';
    expect(resolveFeatureFlagsFromEnv().toolBuildQueryEnabled).toBe(false);
  });

  it('disables toolBuildChartNarrativeEnabled when TOOL_BUILD_CHART_NARRATIVE_ENABLED=false', () => {
    process.env.TOOL_BUILD_CHART_NARRATIVE_ENABLED = 'false';
    expect(resolveFeatureFlagsFromEnv().toolBuildChartNarrativeEnabled).toBe(false);
  });

  it('disables toolBuildChartNarrativeEnabled when TOOL_BUILD_CHART_NARRATIVE_ENABLED=0', () => {
    process.env.TOOL_BUILD_CHART_NARRATIVE_ENABLED = '0';
    expect(resolveFeatureFlagsFromEnv().toolBuildChartNarrativeEnabled).toBe(false);
  });
});

// ─── resolveFeatureFlagsFromUrl ──────────────────────────────────────────────

describe('resolveFeatureFlagsFromUrl', () => {
  it('uses env defaults when no query params are present', () => {
    const flags = resolveFeatureFlagsFromUrl(new URL('http://localhost/mcp'));
    expect(flags.mcpAppEnabled).toBe(true);
    expect(flags.toolBuildQueryEnabled).toBe(false);
    expect(flags.toolBuildChartNarrativeEnabled).toBe(true);
  });

  it('URL param overrides env: mcpAppEnabled=false disables mcpAppEnabled even when env is unset', () => {
    const flags = resolveFeatureFlagsFromUrl(new URL('http://localhost/mcp?mcpAppEnabled=false'));
    expect(flags.mcpAppEnabled).toBe(false);
  });

  it('URL param overrides env: toolBuildQueryEnabled=true enables toolBuildQueryEnabled', () => {
    const flags = resolveFeatureFlagsFromUrl(
      new URL('http://localhost/mcp?toolBuildQueryEnabled=true'),
    );
    expect(flags.toolBuildQueryEnabled).toBe(true);
  });

  it('URL param overrides env: toolBuildQueryEnabled=1 enables toolBuildQueryEnabled', () => {
    const flags = resolveFeatureFlagsFromUrl(
      new URL('http://localhost/mcp?toolBuildQueryEnabled=1'),
    );
    expect(flags.toolBuildQueryEnabled).toBe(true);
  });

  it('URL param overrides env: toolBuildChartNarrativeEnabled=false disables toolBuildChartNarrativeEnabled', () => {
    const flags = resolveFeatureFlagsFromUrl(
      new URL('http://localhost/mcp?toolBuildChartNarrativeEnabled=false'),
    );
    expect(flags.toolBuildChartNarrativeEnabled).toBe(false);
  });

  it('URL param is case-insensitive: mcpAppEnabled=FALSE disables mcpAppEnabled', () => {
    const flags = resolveFeatureFlagsFromUrl(new URL('http://localhost/mcp?mcpAppEnabled=FALSE'));
    expect(flags.mcpAppEnabled).toBe(false);
  });

  it('URL param overrides env var: env=false but URL=true re-enables flag', () => {
    process.env.MCP_APP_ENABLED = 'false';
    const flags = resolveFeatureFlagsFromUrl(new URL('http://localhost/mcp?mcpAppEnabled=true'));
    expect(flags.mcpAppEnabled).toBe(true);
  });

  it('invalid URL param value falls back to env', () => {
    process.env.TOOL_BUILD_QUERY_ENABLED = 'true';
    // 'yes' is not a valid boolean value — should fall through to env
    const flags = resolveFeatureFlagsFromUrl(
      new URL('http://localhost/mcp?toolBuildQueryEnabled=yes'),
    );
    expect(flags.toolBuildQueryEnabled).toBe(true);
  });

  it('invalid URL param value falls back to env default when env unset', () => {
    // 'enabled' is invalid — falls back to opt-in default (false)
    const flags = resolveFeatureFlagsFromUrl(
      new URL('http://localhost/mcp?toolBuildQueryEnabled=enabled'),
    );
    expect(flags.toolBuildQueryEnabled).toBe(false);
  });
});

// ─── applyFeatureFlagsToSession ───────────────────────────────────────────────

describe('applyFeatureFlagsToSession', () => {
  it('stores resolved flags in session state under featureFlags key', () => {
    const state = new Map<string, unknown>();
    const url = new URL('http://localhost/mcp?toolBuildQueryEnabled=true');
    applyFeatureFlagsToSession(url, state);
    const stored = state.get('featureFlags') as { toolBuildQueryEnabled: boolean };
    expect(stored.toolBuildQueryEnabled).toBe(true);
  });

  it('overwrites previously stored flags on reconnect', () => {
    const state = new Map<string, unknown>();
    state.set('featureFlags', {
      mcpAppEnabled: false,
      toolBuildQueryEnabled: false,
      toolBuildChartNarrativeEnabled: false,
    });
    applyFeatureFlagsToSession(new URL('http://localhost/mcp?mcpAppEnabled=true'), state);
    const stored = state.get('featureFlags') as { mcpAppEnabled: boolean };
    expect(stored.mcpAppEnabled).toBe(true);
  });
});

// ─── getFeatureFlags ─────────────────────────────────────────────────────────

describe('getFeatureFlags', () => {
  it('reads from session state when featureFlags key is present', () => {
    const state = new Map<string, unknown>();
    state.set('featureFlags', {
      mcpAppEnabled: false,
      toolBuildQueryEnabled: true,
      toolBuildChartNarrativeEnabled: false,
    });
    const flags = getFeatureFlags(state);
    expect(flags.mcpAppEnabled).toBe(false);
    expect(flags.toolBuildQueryEnabled).toBe(true);
    expect(flags.toolBuildChartNarrativeEnabled).toBe(false);
  });

  it('falls back to env when session state has no featureFlags key', () => {
    process.env.TOOL_BUILD_QUERY_ENABLED = 'true';
    const state = new Map<string, unknown>();
    const flags = getFeatureFlags(state);
    expect(flags.toolBuildQueryEnabled).toBe(true);
  });

  it('falls back to env when sessionState is undefined', () => {
    process.env.MCP_APP_ENABLED = 'false';
    const flags = getFeatureFlags(undefined);
    expect(flags.mcpAppEnabled).toBe(false);
  });

  it('returns env defaults when called with no args', () => {
    const flags = getFeatureFlags();
    expect(flags.mcpAppEnabled).toBe(true);
    expect(flags.toolBuildQueryEnabled).toBe(false);
    expect(flags.toolBuildChartNarrativeEnabled).toBe(true);
  });
});
