---
name: sisense-mcp-server
description: >-
  Context, pitfalls, and patterns for working on the sisense-mcp-server repo.
  Covers session state architecture, ID generation, MCP app vs tool mode,
  security constraints, and lessons from past bugs.
---

# Sisense MCP Server — Repo Guide

Use this skill whenever you're about to add a tool, touch session state, generate artifact IDs, or handle credentials. It captures lessons learned from real bugs in this codebase.

---

## Project Commands

```bash
bun run test                # unit tests (bun + preloaded setup.ts)
bun run test:e2e            # end-to-end tests (requires built server)
bun run build               # vite view build + bun SSE server bundle
bun run dev                 # watch mode (no build needed)
bun run type-check          # tsc --noEmit (run before committing)
bun run lint                # eslint src/**/*.ts
```

### Commit Messages — Conventional Commits

Format: `<type>[(optional scope)]: <description> (SNS-XXXXX)`

The Jira ticket `(SNS-xxx)` is **mandatory** at the end of the header line.

```
fix(buildChart): use crypto.randomUUID() for toolCallId (SNS-128032)

Replace requestId with randomUUID so chartIds are unique per tool call.
JSON-RPC requestId is always 1 from Claude, causing every chart to get
the same ID.
```

Supported `<type>` values:

| Type       | When to use                                                |
| ---------- | ---------------------------------------------------------- |
| `feat`     | New feature                                                |
| `fix`      | Bug fix                                                    |
| `refactor` | Code change that neither fixes a bug nor adds a feature    |
| `style`    | Whitespace, formatting, semicolons — no logic change       |
| `docs`     | Documentation only                                         |
| `build`    | Build system or dependency changes (scopes: `vite`, `bun`) |
| `ci`       | CI configuration changes (scope: `gitlab`)                 |
| `perf`     | Performance improvement                                    |
| `test`     | Adding or correcting tests                                 |
| `chore`    | Anything that doesn't modify src or test files             |
| `revert`   | Reverts a previous commit                                  |

Changelog follows [common-changelog.org](https://common-changelog.org/) conventions.

---

## Architecture at a Glance

```
HTTP request → sse-server.ts
                 ├── credential hash → persistentStates Map
                 │     (survives client reconnects for same user)
                 └── MCP session ID → sessions Map (transport + state ref)
                       └── setupMcpServer(sessionState) → mcp-server.ts
                             ├── tools/build-chart.ts
                             ├── tools/get-data-sources.ts
                             └── tools/get-data-source-fields.ts
```

**`SessionState = Map<string, unknown>`** — the single source of truth per session.

---

## SessionState Key Taxonomy

| Key                   | Type                                                  | Persists across conversation reset?               |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| `sisenseUrl`          | `string`                                              | YES — credential                                  |
| `sisenseToken`        | `string`                                              | YES — credential                                  |
| `httpClient`          | `HttpClient`                                          | YES — credential                                  |
| `openAIClient`        | `SessionOpenAIClient`                                 | YES — credential                                  |
| `baseUrl`             | `string`                                              | REFRESHED — updated from request headers on reset |
| `chart:summaries`     | `ChartSummary[]`                                      | NO — cleared on conversation reset                |
| `chart-${id}`         | `ExtendedChartWidgetProps`                            | NO — cleared on conversation reset                |
| `chart:payload:${id}` | `{ sisenseUrl, sisenseToken, serializedWidgetProps }` | YES — preserved for analytics app re-rendering    |

**Why the split matters:** When the same user starts a new conversation (same credentials, new MCP session), `resetConversationState()` clones the state, clears the `chart:summaries` and `chart-${id}` keys so the LLM doesn't see stale context, but preserves `chart:payload:${id}` so the analytics app can still re-render charts from previous sessions.

---

## Pitfall: `extra.requestId` Is NOT a Unique Tool Call ID

The MCP SDK exposes `extra.requestId` in tool handlers, but Claude sends `requestId=1` for every invocation — it's a JSON-RPC correlation ID, not a per-call unique ID. Never use it to identify artifacts.

Use `generateArtifactId()` instead:

```ts
import { generateArtifactId } from '../utils/string-utils.js';

const toolCallId = generateArtifactId('chart'); // → 'chart-3f2504e0'
```

First 8 hex chars of a UUID — short enough for LLMs to reference, unique enough in practice.

---

## Pitfall: Global Sisense SDK Client Fallback

> **Bug hit in SNS-128031**: Tools without credentials were silently falling through to the global Sisense SDK `httpClient`, causing requests to succeed under the wrong user context.

Always get clients from session — never assume a global fallback:

```ts
import { getSessionHttpClient, getSessionOpenAIClient } from '../utils/sisense-session.js';

const httpClient = getSessionHttpClient(sessionState); // throws MISSING_SISENSE_SESSION_MESSAGE if absent
const openAIClient = getSessionOpenAIClient(sessionState);
```

These functions throw explicitly. That's intentional — a missing client is a bug, not a fallback case.

---

## Pitfall: Large Payloads in `_meta` Break Clients

> **Bug hit in SNS-128032**: Chart payload (serialized widget props + credentials) was returned in the `_meta` field of the tool response. Cursor and ChatGPT couldn't handle it.

**Use MCP resources for large data.** The pattern in this repo:

1. `buildChart` stores the payload in `sessionState.set('chart:payload:${chartId}', payload)`
2. `mcp-server.ts` registers a `ResourceTemplate` at `ui://sisense-analytics/chart/{chartId}`
3. The analytics app fetches the resource via `resources/read`, not from `_meta`

If you're tempted to put large data in `_meta`, put it in a resource instead.

---

## MCP App Mode vs Tool Mode

Controlled by `MCP_APP_ENABLED` env var. The feature flag pattern used throughout:

```ts
function isMcpAppEnabled(): boolean {
  return process.env.MCP_APP_ENABLED !== 'false' && process.env.MCP_APP_ENABLED !== '0';
}
```

Feature flags are **enabled by default** (opt-out, not opt-in). Check both `'false'` and `'0'`.

| Mode               | How chart is delivered                                   | Tool registered via     |
| ------------------ | -------------------------------------------------------- | ----------------------- |
| App mode (default) | MCP resource at `ui://sisense-analytics/chart/{chartId}` | `registerAppTool()`     |
| Tool mode          | PNG screenshot, `imageUrl` in response                   | `server.registerTool()` |

When adding a new tool, decide up-front which mode applies and wire it conditionally if needed.

---

## Adding a New Tool — Checklist

1. **Get credentials from session** — use `getSessionHttpClient()`, `getSessionOpenAIClient()`, `getSessionSisenseUrl()`, `getSessionSisenseToken()` from `src/utils/sisense-session.ts`. Never touch globals.
2. **Generate artifact IDs with `generateArtifactId(type)`** — not `Date.now()`, not `extra.requestId`, not session counters. Same rule applies to S3 filenames (`randomUUID()` not `Date.now()`).
3. **Wrap CSDK calls** in `csdkBrowserMock.withBrowserEnvironment(async () => { ... })`.
4. **Wrap engine calls** in `runWithUserAction('MCP', 'ASSISTANT', () => ...)` for telemetry.
5. **Sanitize errors before logging** — `console.warn(sanitizeError(err).message)`. Never log raw errors; they may contain tokens in URLs.
6. **Sanitize user input** — `sanitizeForText(userPrompt)` for prompts, `sanitizeForDescription()` for short strings.
7. **Return `isError: true`** in catch blocks alongside structured content (see `buildChart` error path).
8. **Register in `mcp-server.ts`** — add tool registration in `setupMcpServer()`.
9. **Write unit tests** with `bun test` preload (`src/__test-helpers__/setup.ts` mocks browser globals).
10. **Update `resetConversationState`** in `sse-server.ts` if the new tool stores per-conversation keys in session state that should be cleared on new conversations.

---

## Session State Reset — What to Clear

When adding session state keys for a new tool, decide: is this **per-conversation** or **per-credential**?

- **Per-conversation** (LLM context, conversation memory): clear in `resetConversationState()` in `sse-server.ts`
- **Per-credential** (auth clients, reusable payloads for the analytics app): leave alone

Update the clear logic at [src/sse-server.ts](src/sse-server.ts) around the `resetConversationState` function. The current predicate is:

```ts
if (key === 'chart:summaries' || (typeof key === 'string' && key.startsWith('chart-'))) {
  freshState.delete(key);
}
```

Add your new keys here if they're per-conversation.

---

## AJV / Bun Compatibility

The MCP SDK's JSON Schema validation is bypassed with a no-op validator because AJV has compatibility issues with Bun:

```ts
const noOpValidator: any = {
  getValidator: () => (input: unknown) => ({ valid: true, data: input, errorMessage: undefined }),
};
new McpServer({ ... }, { jsonSchemaValidator: noOpValidator });
```

**Zod handles all validation internally.** Don't remove this or try to wire in AJV — it will break.

---

## Credential Key (Persistent State)

The `persistentStates` Map is keyed by a 16-char hex credential hash:

```ts
createHash('sha256').update(`${sisenseUrl}:${sisenseToken}`).digest('hex').slice(0, 16);
```

This means: same user with same credentials → same persistent state, regardless of how many times they reconnect. New conversation resets per-conversation keys but preserves credentials and reusable payloads.
