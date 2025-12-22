import { test, expect } from '@playwright/experimental-ct-react';
import { readFileSync } from 'node:fs';
import { WidgetStory } from './widget-renderer.story';

/**
 * Widget renderer test - reads config from file and renders widget
 * The story file contains the component with CustomSuperJSON import,
 * which only runs in browser context to avoid Node.js 'self is not defined' errors
 */
test.describe('Widget Renderer', () => {
  test('render widget from config', async ({ mount, page }) => {
    // Read widget config from environment variable
    const configPath = process.env.WIDGET_CONFIG_PATH;
    if (!configPath) {
      throw new Error('WIDGET_CONFIG_PATH environment variable is required');
    }

    // Read serialized config (will be deserialized in the browser)
    const serializedConfig = readFileSync(configPath, 'utf8');

    // Mount the component - deserialization happens in browser
    const component = await mount(<WidgetStory serializedConfig={serializedConfig} />);

    // Wait for widget container to appear (works for both Highcharts and indicators)
    await page.waitForSelector('[data-test-id="widget-container"]', {
      timeout: 4000,
      state: 'attached',
    });

    // Wait for network to be idle (data fetching complete)
    await page.waitForLoadState('networkidle', { timeout: 4000 });

    // Wait for widget content to be rendered (any child element)
    await page.waitForSelector('[data-test-id="widget-container"] > div', {
      timeout: 4000,
    });

    // Small wait for widget to finish rendering (animations, etc.)
    await page.waitForTimeout(500);

    // Take screenshot to custom path if provided
    const screenshotPath = process.env.SCREENSHOT_OUTPUT_PATH;
    if (screenshotPath) {
      await component.screenshot({ path: screenshotPath, timeout: 2000 });
    } else {
      // Fallback to default snapshot behavior
      await expect(component).toHaveScreenshot('widget-render.png', {
        timeout: 2000,
      });
    }
  });
});
