import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
