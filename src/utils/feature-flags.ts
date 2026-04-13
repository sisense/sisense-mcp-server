import type { SessionState } from '../types/sessions.js';

export interface SessionFeatureFlags {
  /** MCP App mode: opt-out — true unless explicitly disabled */
  mcpAppEnabled: boolean;
  /** Build query tool: opt-in — false unless explicitly enabled */
  toolBuildQueryEnabled: boolean;
  /** NLG chart narrative: opt-out — true unless explicitly disabled */
  toolBuildChartNarrativeEnabled: boolean;
}

/**
 * Parse a URL query parameter value as a boolean.
 * Accepts true/false/1/0 (case-insensitive).
 * Invalid values (anything not in that set) fall through to env — returns null.
 */
function parseBooleanParam(value: string | null): boolean | null {
  if (value === null) return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'true' || trimmed === '1') return true;
  if (trimmed === 'false' || trimmed === '0') return false;
  // Invalid values (anything not true/false/1/0) fall through to env
  return null;
}

/** Resolve feature flags from environment variables only. */
export function resolveFeatureFlagsFromEnv(): SessionFeatureFlags {
  return {
    // opt-out: enabled unless explicitly set to 'false' or '0'
    mcpAppEnabled: process.env.MCP_APP_ENABLED !== 'false' && process.env.MCP_APP_ENABLED !== '0',
    // opt-in: enabled only if explicitly set to 'true' or '1'
    toolBuildQueryEnabled:
      process.env.TOOL_BUILD_QUERY_ENABLED === 'true' ||
      process.env.TOOL_BUILD_QUERY_ENABLED === '1',
    // opt-out: enabled unless explicitly set to 'false' or '0'
    toolBuildChartNarrativeEnabled:
      process.env.TOOL_BUILD_CHART_NARRATIVE_ENABLED !== 'false' &&
      process.env.TOOL_BUILD_CHART_NARRATIVE_ENABLED !== '0',
  };
}

/**
 * Resolve feature flags from URL query params, falling back to env vars.
 * Query param names (camelCase): mcpAppEnabled, toolBuildQueryEnabled, toolBuildChartNarrativeEnabled
 */
export function resolveFeatureFlagsFromUrl(url: URL): SessionFeatureFlags {
  const env = resolveFeatureFlagsFromEnv();
  return {
    mcpAppEnabled: parseBooleanParam(url.searchParams.get('mcpAppEnabled')) ?? env.mcpAppEnabled,
    toolBuildQueryEnabled:
      parseBooleanParam(url.searchParams.get('toolBuildQueryEnabled')) ?? env.toolBuildQueryEnabled,
    toolBuildChartNarrativeEnabled:
      parseBooleanParam(url.searchParams.get('toolBuildChartNarrativeEnabled')) ??
      env.toolBuildChartNarrativeEnabled,
  };
}

/**
 * Resolve flags from the connect URL and store them on the session state.
 * Call this once per initialize, immediately before setupMcpServer(state).
 */
export function applyFeatureFlagsToSession(url: URL, state: SessionState): void {
  state.set('featureFlags', resolveFeatureFlagsFromUrl(url));
}

/**
 * Read feature flags from session state, falling back to env vars for callers
 * that don't go through SSE initialize (e.g. test fixtures, in-memory transport).
 */
export function getFeatureFlags(sessionState?: SessionState): SessionFeatureFlags {
  const stored = sessionState?.get('featureFlags');
  if (stored != null) {
    return stored as SessionFeatureFlags;
  }
  return resolveFeatureFlagsFromEnv();
}
