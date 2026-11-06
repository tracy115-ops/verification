import { defineConfig } from '@playwright/test';

// Opt-in actual Release WebView. No browser launch, IPC stub, or model fixture.
export default defineConfig({
  testDir: './tests/live',
  testMatch: ['**/desktop-workflow.spec.ts', '**/desktop-source.spec.ts'],
  timeout: 1_800_000,
  retries: 0,
  workers: 1,
  outputDir: '.runtime/playwright-desktop',
});
