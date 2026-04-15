import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export const DEFAULT_TOOL_FAILURE_FALLBACK =
  'The tool did not return the information needed to display this view.';

export type DeriveToolFailureMessageOptions = {
  /** Used when the result has no structured `message`, no text content, and no parseable JSON `message`. */
  fallback?: string;
};

function messageFromJsonText(raw: string): string | undefined {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (isNonEmptyString(parsed.message)) return parsed.message as string;
  } catch {
    // not JSON or no message field
  }
  return undefined;
}

const INVALID_ARGS_MARKER = 'Invalid arguments for tool ';

function formatIssuePath(path: unknown): string {
  if (typeof path === 'string') return path;
  if (Array.isArray(path) && path.every((p) => typeof p === 'string' || typeof p === 'number')) {
    return path.map((p) => String(p)).join('.');
  }
  return '?';
}

/**
 * Turns MCP host input-validation errors (Zod-style issue list after the tool name) into a short, readable message.
 */
function formatMcpInputValidationError(text: string): string | undefined {
  const markerIndex = text.indexOf(INVALID_ARGS_MARKER);
  if (markerIndex === -1) return undefined;

  const afterMarker = text.slice(markerIndex + INVALID_ARGS_MARKER.length).trimStart();
  const toolMatch = /^([^\s:]+)\s*:\s*(\[[\s\S]*)$/.exec(afterMarker);
  if (!toolMatch) return undefined;

  const toolName = toolMatch[1];
  const jsonPart = toolMatch[2].trim();

  let issues: unknown;
  try {
    issues = JSON.parse(jsonPart);
  } catch {
    return undefined;
  }
  if (!Array.isArray(issues) || issues.length === 0) return undefined;

  const lines: string[] = [];
  for (const row of issues) {
    if (!row || typeof row !== 'object') return undefined;
    const r = row as Record<string, unknown>;
    if (!isNonEmptyString(r.message)) return undefined;
    const pathLabel = formatIssuePath(r.path);
    lines.push(`• ${pathLabel}: ${(r.message as string).trim()}`);
  }

  return [`Invalid arguments for ${toolName}:`, '', ...lines].join('\n');
}

function collectTextBlocks(toolResult: CallToolResult): string[] {
  const out: string[] = [];
  if (!Array.isArray(toolResult.content)) return out;
  for (const item of toolResult.content) {
    const b = item as Record<string, unknown>;
    if (b.type === 'text' && isNonEmptyString(b.text)) {
      out.push((b.text as string).trim());
    }
  }
  return out;
}

/**
 * Human-readable explanation from an MCP `CallToolResult` when the UI cannot proceed
 * (e.g. missing resource id). Shared by chart, dashboard, or any Sisense MCP app view.
 *
 * Priority: `structuredContent.message` → formatted MCP input-validation (if present) →
 * text `content` (JSON `message` for a single block) → joined text blocks → first block `text` → `fallback`.
 */
export function deriveToolFailureMessage(
  toolResult: CallToolResult,
  options?: DeriveToolFailureMessageOptions,
): string {
  const fallback = options?.fallback ?? DEFAULT_TOOL_FAILURE_FALLBACK;
  const structured = toolResult.structuredContent as Record<string, unknown> | undefined;
  if (isNonEmptyString(structured?.message)) {
    return structured!.message as string;
  }

  const texts = collectTextBlocks(toolResult);

  if (texts.length === 1) {
    const single = texts[0];
    return formatMcpInputValidationError(single) ?? messageFromJsonText(single) ?? single;
  }
  if (texts.length > 1) {
    return texts.join('\n');
  }

  const first = Array.isArray(toolResult.content) ? toolResult.content[0] : undefined;
  const raw =
    first && typeof (first as Record<string, unknown>).text === 'string'
      ? (first as { text: string }).text.trim()
      : '';
  if (raw.length > 0) {
    return formatMcpInputValidationError(raw) ?? messageFromJsonText(raw) ?? raw;
  }

  return fallback;
}
