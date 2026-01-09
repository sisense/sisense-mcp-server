import { defineConfig, devices } from '@playwright/experimental-ct-react';

export default defineConfig({
  testDir: './src/utils/widget-renderer',
  testMatch: '**/*.spec.tsx',
  snapshotDir: './__screenshots__',
  timeout: 90 * 1000, // 90 seconds to accommodate all operations
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',

  use: {
    trace: 'off', // Disable trace for speed
    ctPort: 3100,
    testIdAttribute: 'data-test-id',
    // Aggressive performance settings
    actionTimeout: 20000, // 20 seconds to allow network operations to complete
    navigationTimeout: 10000, // Fast navigation timeout
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        // Aggressive browser args for faster rendering
        launchOptions: {
          // Use system Chromium if PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is set (Docker)
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-blink-features=AutomationControlled',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
        },
      },
    },
  ],
});
