import { defineConfig } from '@playwright/test';
import base from './playwright.config';

process.env.PRODUCT_AUDIT_ROOT = '.runtime/product-audit-development';
export default defineConfig(base, {
  testMatch: '**/product-audit.spec.ts',
  maxFailures: 1,
  outputDir: '.runtime/playwright-visual-development',
  use: { baseURL: 'http://127.0.0.1:5177' },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5177 --strictPort',
    url: 'http://127.0.0.1:5177',
    reuseExistingServer: false,
  },
});
