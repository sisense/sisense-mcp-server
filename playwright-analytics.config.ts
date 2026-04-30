import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/visual-tests',
  testMatch: 'analytics-app-render.spec.ts',
  snapshotPathTemplate: '{testDir}/__snapshots__/{arg}-{projectName}-{platform}{ext}',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:5174',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npx cross-env INPUT=view.html vite --port 5174',
    port: 5174,
    // If true, any process already bound to 5174 is reused — not necessarily this Vite
    // input, which breaks the MCP handshake (_appReady). Opt in with PW_REUSE_ANALYTICS_SERVER=1.
    reuseExistingServer: process.env.PW_REUSE_ANALYTICS_SERVER === '1',
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
          ],
        },
      },
    },
  ],
});
