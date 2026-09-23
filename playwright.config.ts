import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 60000, workers: 1,
  expect: { timeout: 10000 },
  use: { browserName: 'chromium', channel: 'chromium', launchOptions: { args: ['--disable-gpu'] }, viewport: { width: 1366, height: 768 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  outputDir: 'artifacts/test-results',
  reporter: [['list'], ['json', { outputFile: 'artifacts/browser-results.json' }]]
});
