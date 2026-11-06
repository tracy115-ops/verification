import { defineConfig } from '@playwright/test';

// Explicit opt-in only: these tests call an installed CLI and may incur model costs.
export default defineConfig({
  testDir: './tests/live',
  testMatch: '**/claude-settings.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 180_000,
  outputDir: '.runtime/playwright-live',
  use: { baseURL: 'http://127.0.0.1:5286', viewport: { width: 1500, height: 960 } },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 5286 --strictPort',
    url: 'http://127.0.0.1:5286',
    reuseExistingServer: false,
  },
});
