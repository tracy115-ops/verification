import { defineConfig } from '@playwright/test';
const production = process.env.WORKBENCH_TEST_PRODUCTION === '1';
const baseURL = production ? 'http://127.0.0.1:5174' : 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/team*.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: '.runtime/playwright',
  use: {
    baseURL,
    viewport: { width: 1500, height: 960 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: production ? 'npm run preview' : 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
