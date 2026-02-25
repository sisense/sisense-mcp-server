/**
 * Sisense Analytics View
 */
import { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import styles from './analytics-app.module.css';
import { ChartWidget, SisenseContextProvider } from '@sisense/sdk-ui';
import { ExtendedChartWidgetProps } from '@sisense/sdk-ai-core';
import { CustomSuperJSON, CustomSuperJSONResult } from '@sisense/sdk-ui/analytics-composer/node';

interface ToolResultMeta {
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

function isToolResultMeta(value: unknown): value is ToolResultMeta {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const meta = value as Record<string, unknown>;
  return (
    isNonEmptyString(meta.sisenseUrl) &&
    isNonEmptyString(meta.sisenseToken) &&
    meta.serializedWidgetProps !== null &&
    meta.serializedWidgetProps !== undefined
  );
}

function AnalyticsAppInner({
  hostContext,
  toolResult,
}: {
  hostContext?: McpUiHostContext;
  toolResult?: CallToolResult;
}) {
  const parsed = useMemo((): ParsedToolResult | null => {
    if (!toolResult) {
      return null;
    }

    const { _meta } = toolResult;
    if (!_meta || !isToolResultMeta(_meta)) {
      console.warn('[SisenseAnalytics] Invalid or missing _meta in tool result', {
        hasMeta: !!_meta,
        metaType: typeof _meta,
      });
      return null;
    }

    const { sisenseUrl, sisenseToken, serializedWidgetProps } = _meta;

    try {
      const widgetProps = CustomSuperJSON.deserialize(
        serializedWidgetProps,
      ) as ExtendedChartWidgetProps;

      if (!widgetProps) {
        console.warn('[SisenseAnalytics] Deserialized widget props is null or undefined');
        return null;
      }

      return {
        sisenseUrl,
        sisenseToken,
        widgetProps,
      };
    } catch (error) {
      console.error('[SisenseAnalytics] Failed to deserialize widget props', error);
      return null;
    }
  }, [toolResult]);

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

  return <AnalyticsAppInner hostContext={hostContext} toolResult={toolResult} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnalyticsApp />
  </StrictMode>,
);
