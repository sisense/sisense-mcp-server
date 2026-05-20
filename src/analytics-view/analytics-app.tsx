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

// Discriminated union for BI artifact types delivered inline via structuredContent.artifactPayload.
// Add new types here as new tools (buildDashboard, etc.) are introduced.
type BiArtifactType = 'chart' | 'dashboard';

interface ChartArtifact {
  type: 'chart';
  sisenseUrl: string;
  sisenseToken: string;
  serializedWidgetProps: CustomSuperJSONResult;
}

interface DashboardArtifact {
  type: 'dashboard';
  sisenseUrl: string;
  sisenseToken: string;
  // dashboardProps: DashboardProps  — add when buildDashboard lands
}

type BiArtifact = ChartArtifact | DashboardArtifact;

interface ParsedToolResult {
  sisenseUrl: string;
  sisenseToken: string;
  widgetProps: ExtendedChartWidgetProps;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isBiArtifact(value: unknown): value is BiArtifact {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    isNonEmptyString(v.type) && isNonEmptyString(v.sisenseUrl) && isNonEmptyString(v.sisenseToken)
  );
}

function AnalyticsAppInner({
  hostContext,
  toolResult,
}: {
  hostContext?: McpUiHostContext;
  toolResult?: CallToolResult;
}) {
  const [parsed, setParsed] = useState<ParsedToolResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!toolResult) return;

    setParsed(null);
    setLoadError(null);

    const structured = toolResult.structuredContent as Record<string, unknown> | undefined;

    function renderArtifact(data: unknown): void {
      if (!isBiArtifact(data)) throw new Error('Invalid artifact payload');

      if (data.type === 'chart') {
        const artifact = data as ChartArtifact;
        const widgetProps = CustomSuperJSON.deserialize(
          artifact.serializedWidgetProps,
        ) as ExtendedChartWidgetProps;
        if (!widgetProps) throw new Error('Deserialized widget props is null');
        setParsed({
          sisenseUrl: artifact.sisenseUrl,
          sisenseToken: artifact.sisenseToken,
          widgetProps,
        });
      } else {
        throw new Error(`Unsupported artifact type: ${(data as { type: BiArtifactType }).type}`);
      }
    }

    if (isBiArtifact(structured?.artifactPayload)) {
      try {
        const payload = structured!.artifactPayload as BiArtifact;
        renderArtifact(payload);
        console.debug('[SisenseAnalytics] Rendered chart from structuredContent.artifactPayload', {
          artifactType: payload.type,
          chartId: structured?.chartId,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to render artifact';
        console.error('[SisenseAnalytics] Failed to render artifact', error);
        setLoadError(message);
      }
      return;
    }

    setLoadError(
      deriveToolFailureMessage(toolResult, {
        fallback: 'The chart tool did not return an artifact payload.',
      }),
    );
  }, [toolResult]);

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
      <div className={styles.chartContainer}>
        <SisenseContextProvider
          url={parsed.sisenseUrl}
          token={parsed.sisenseToken}
          showRuntimeErrors={true}
        >
          <ChartWidget {...parsed.widgetProps} />
        </SisenseContextProvider>
      </div>
    </main>
  );
}

function AnalyticsApp() {
  const [toolResult, setToolResult] = useState<CallToolResult | undefined>();
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();

  const { app, error } = useApp({
    appInfo: { name: 'Sisense Analytics View', version: '1.0.0' },
    capabilities: {},
    // default autoResize: true — keep enabled; chartContainer anchors CSDK layout (see skill)
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

  return <AnalyticsAppInner hostContext={hostContext} toolResult={toolResult} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnalyticsApp />
  </StrictMode>,
);
