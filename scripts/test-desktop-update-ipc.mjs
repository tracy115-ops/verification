import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Attach to the actual installed release WebView, not a mocked browser bridge.
const endpoint = process.argv[2];
assert.match(endpoint ?? '', /^http:\/\/127\.0\.0\.1:\d+$/);
const deadline = Date.now() + 30_000;
while (true) {
  try {
    const response = await fetch(`${endpoint}/json/version`);
    if (response.ok) break;
  } catch {}
  assert.ok(Date.now() < deadline, 'Installed desktop debugging endpoint did not start');
  await new Promise((resolve) => setTimeout(resolve, 200));
}
const browser = await chromium.connectOverCDP(endpoint);
try {
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.waitForEvent('page', { timeout: 60_000 }));
  await page.waitForFunction(() => typeof window.__TAURI_INTERNALS__?.invoke === 'function');
  const result = await page.evaluate(async () => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    try {
      await invoke('install_update');
      return { error: null };
    } catch (error) {
      return { error, status: await invoke('update_status') };
    }
  });
  assert.equal(result.error, 'update_check_first');
  assert.equal(result.status.supported, true);
  assert.equal(result.status.ready, false);
  console.log(`Installed release ${result.status.currentVersion}: native install IPC gate passed`);
} finally {
  await browser.close();
}
