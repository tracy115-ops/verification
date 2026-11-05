import { defineConfig } from '@playwright/test';
const production = process.env.WORKBENCH_TEST_PRODUCTION === '1';
const baseURL = production ? 'http://127.0.0.1:5284' : 'http://127.0.0.1:5173';

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
    command: production ? 'npx vite preview --host 127.0.0.1 --port 5284 --strictPort' : 'npm run dev',
    url: baseURL,
    reuseExistingServer: !production && !process.env.CI,
  },
});
