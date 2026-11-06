import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/live',
  testMatch: '**/desktop-report.spec.ts',
  timeout: 120_000,
  workers: 1,
  retries: 0,
  outputDir: '.runtime/playwright-report-native',
});
