import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/team*.spec.ts',
  workers: 1,
  timeout: 60000,
  fullyParallel: false,
  reporter: 'list',
  outputDir: '.runtime/playwright-team',
  use: {
    baseURL: 'http://127.0.0.1:4318',
    viewport: { width: 1500, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node server/index.ts --host 127.0.0.1 --port 4318 --data-dir .runtime/team-e2e',
    url: 'http://127.0.0.1:4318/api/team/health',
    reuseExistingServer: false,
    env: { TEAM_OWNER_TOKEN: 'offline-team-e2e-owner-token-000000000000000000000000' },
  },
});
