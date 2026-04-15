/**
 * Sisense Analytics View
 */
import { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import styles from './analytics-app.module.css';
import { deriveToolFailureMessage } from './tool-result-message.js';
import { ChartWidget, SisenseContextProvider } from '@sisense/sdk-ui';
import { ExtendedChartWidgetProps } from '@sisense/sdk-ai-core';
import { CustomSuperJSON, CustomSuperJSONResult } from '@sisense/sdk-ui/analytics-composer/node';

interface ChartPayload {
  sisenseUrl: string;
  sisenseToken: string;
  serializedWidgetProps: CustomSuperJSONResult;
}

interface ParsedToolResult {
  sisenseUrl: string;
  sisenseToken: string;
  widgetProps: ExtendedChartWidgetProps;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isChartPayload(value: unknown): value is ChartPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    isNonEmptyString(v.sisenseUrl) &&
    isNonEmptyString(v.sisenseToken) &&
    v.serializedWidgetProps !== null &&
    v.serializedWidgetProps !== undefined
  );
}

function extractChartId(toolResult: CallToolResult): string | undefined {
  const structured = toolResult.structuredContent as Record<string, unknown> | undefined;
  if (isNonEmptyString(structured?.chartId)) return structured!.chartId as string;
  const firstContent = Array.isArray(toolResult.content) ? toolResult.content[0] : undefined;
  const rawText =
    firstContent && typeof (firstContent as Record<string, unknown>).text === 'string'
      ? (firstContent as { text: string }).text
      : undefined;
  if (rawText) {
    try {
      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      if (isNonEmptyString(parsed.chartId)) return parsed.chartId as string;
    } catch {
      // ignore parse errors
    }
  }
  return undefined;
}

function AnalyticsAppInner({
  hostContext,
  toolResult,
  app,
}: {
  hostContext?: McpUiHostContext;
  toolResult?: CallToolResult;
  app: App;
}) {
  const [parsed, setParsed] = useState<ParsedToolResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!toolResult) return;

    setParsed(null);
    setLoadError(null);

    const chartId = extractChartId(toolResult);
    if (!chartId) {
      setLoadError(
        deriveToolFailureMessage(toolResult, {
          fallback: 'The chart tool did not return a chart id.',
        }),
      );
      return;
    }

    app
      .readServerResource({ uri: `ui://sisense-analytics/chart/${chartId}` })
      .then((resourceResult) => {
        const text =
          Array.isArray(resourceResult.contents) && resourceResult.contents.length > 0
            ? (resourceResult.contents[0] as { text?: string }).text
            : undefined;
        if (!text) throw new Error('Empty resource content');
        const payload = JSON.parse(text) as unknown;
        if (!isChartPayload(payload)) throw new Error('Invalid chart resource payload');
        const widgetProps = CustomSuperJSON.deserialize(
          payload.serializedWidgetProps,
        ) as ExtendedChartWidgetProps;
        if (!widgetProps) throw new Error('Deserialized widget props is null');
        setParsed({
          sisenseUrl: payload.sisenseUrl,
          sisenseToken: payload.sisenseToken,
          widgetProps,
        });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to fetch chart resource';
        console.error('[SisenseAnalytics] Failed to fetch chart resource', error);
        setLoadError(message);
      });
  }, [toolResult, app]);

  if (loadError) {
    return (
      <div className={styles.placeholder}>
        <p className={`${styles.error} ${styles.errorDetails}`}>ERROR: {loadError}</p>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className={styles.placeholder}>
        <p>Loading chart...</p>
      </div>
    );
  }

  const insets = hostContext?.safeAreaInsets;
  const paddingStyle = insets
    ? {
        paddingTop: insets.top,
        paddingRight: insets.right,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
      }
    : undefined;

  return (
    <main className={styles.main} style={paddingStyle}>
      <SisenseContextProvider
        url={parsed.sisenseUrl}
        token={parsed.sisenseToken}
        showRuntimeErrors={true}
      >
        <ChartWidget {...parsed.widgetProps} />
      </SisenseContextProvider>
    </main>
  );
}

function AnalyticsApp() {
  const [toolResult, setToolResult] = useState<CallToolResult | undefined>();
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();

  const { app, error } = useApp({
    appInfo: { name: 'Sisense Analytics View', version: '1.0.0' },
    capabilities: {},
    onAppCreated: (a: App) => {
      a.ontoolresult = async (result) => {
        console.info('[SisenseAnalytics] Tool result received', result);
        setToolResult(result);
      };
      a.onhostcontextchanged = (params) => {
        console.info('[SisenseAnalytics] Host context changed', params);
        setHostContext((prev) => ({ ...prev, ...params }));
      };
    },
  });

  useEffect(() => {
    if (app) {
      console.log('[SisenseAnalytics] App created', app);
      setHostContext(app.getHostContext());
    }
  }, [app]);

  if (error) {
    return (
      <div className={styles.placeholder}>
        <p className={styles.error}>ERROR: {error.message}</p>
      </div>
    );
  }
  if (!app) {
    return (
      <div className={styles.placeholder}>
        <p>Connecting…</p>
      </div>
    );
  }
  if (!hostContext) {
    return (
      <div className={styles.placeholder}>
        <p>Connecting…</p>
      </div>
    );
  }

  return <AnalyticsAppInner hostContext={hostContext} toolResult={toolResult} app={app} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnalyticsApp />
  </StrictMode>,
);
