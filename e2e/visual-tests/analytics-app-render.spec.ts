import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('buildChart renders interactive chart in analytics app', async ({ page }) => {
  // 1. Read the tool result from temp file (written by orchestrator)
  const toolResultPath = process.env.TOOL_RESULT_PATH;
  if (!toolResultPath) throw new Error('TOOL_RESULT_PATH env var required');
  const toolResult = JSON.parse(readFileSync(toolResultPath, 'utf8'));

  // 2. Navigate to host page (iframe loads view.html automatically)
  await page.goto('/test-host.html');

  // 3. Wait for MCP App handshake to complete
  await page.waitForFunction(() => (window as any)._appReady === true, null, { timeout: 15_000 });

  // 4. Send tool result to analytics app via postMessage
  await page.evaluate((result) => (window as any).sendToolResult(result), toolResult);

  // 5. Wait for chart to render inside iframe
  const frame = page.frameLocator('#app');
  await frame.locator('.highcharts-root').waitFor({ state: 'visible', timeout: 30_000 });

  // 6. Assert no error state
  const errorCount = await frame.locator('.csdk-error-boundary').count();
  expect(errorCount).toBe(0);

  // 7. Screenshot + snapshot comparison
  const chartElement = frame.locator('main');
  await expect(chartElement).toHaveScreenshot('analytics-app-chart.png', {
    timeout: 10_000,
    maxDiffPixelRatio: 0.05,
  });
});
