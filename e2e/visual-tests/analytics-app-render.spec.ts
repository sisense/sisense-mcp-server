import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('buildChart renders interactive chart in analytics app', async ({ page }) => {
  // 1. Read the tool result + chart payload from temp file (written by orchestrator)
  const toolResultPath = process.env.TOOL_RESULT_PATH;
  if (!toolResultPath) throw new Error('TOOL_RESULT_PATH env var required');
  const { toolResult, chartId, chartPayload } = JSON.parse(
    readFileSync(toolResultPath, 'utf8'),
  ) as {
    toolResult: unknown;
    chartId: string;
    chartPayload: string;
  };

  // 2. Navigate to host page (iframe loads view.html automatically)
  await page.goto('/test-host.html');

  // 3. Wait for MCP App handshake to complete
  await page.waitForFunction(() => (window as any)._appReady === true, null, { timeout: 15_000 });

  // 4. Register chart payload with the test host so it can serve resources/read requests
  await page.evaluate(
    ({ chartId, chartPayload }) => (window as any).setChartPayload(chartId, chartPayload),
    { chartId, chartPayload },
  );

  // 5. Send tool result to analytics app via postMessage
  await page.evaluate((result) => (window as any).sendToolResult(result), toolResult);

  // 6. Wait for chart to render inside iframe
  const frame = page.frameLocator('#app');
  await frame.locator('.highcharts-root').waitFor({ state: 'visible', timeout: 30_000 });

  // 7. Assert no error state
  const errorCount = await frame.locator('.csdk-error-boundary').count();
  expect(errorCount).toBe(0);

  // 8. Screenshot + snapshot comparison
  const chartElement = frame.locator('main');
  await expect(chartElement).toHaveScreenshot('analytics-app-chart.png', {
    timeout: 10_000,
    maxDiffPixelRatio: 0.05,
  });
});
