import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

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
  assert.equal(result.error, 'update_backup_required');
  assert.equal(result.status.supported, true);
  assert.equal(result.status.ready, false);
  console.log(`Installed release ${result.status.currentVersion}: native install IPC gate passed`);
  if (process.env.GITHUB_ACTIONS === 'true') {
    assert.ok(process.env.RUNNER_TEMP);
    const directory = await page.evaluate(() =>
      window.__TAURI_INTERNALS__.invoke('plugin:path|resolve_directory', { directory: 15 }),
    );
    const database = path.join(directory, 'personal-shadow-v1.sqlite3');
    assert.equal(
      existsSync(database),
      false,
      'Disposable runner must not contain a pre-existing protection copy',
    );
    await page.locator('.session-history-new').click();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '数据管理', exact: true }).click();
    const copies = page.locator('.settings-shadow');
    await copies.getByRole('button', { name: '创建并校验副本' }).click();
    await copies.getByRole('status').filter({ hasText: '完整性校验通过' }).waitFor();
    const bytes = readFileSync(database);
    assert.equal(bytes.subarray(0, 16).toString(), 'SQLite format 3\0');
    writeFileSync(
      path.join(process.env.RUNNER_TEMP, 'verification-update-shadow.json'),
      JSON.stringify({ path: database, sha256: createHash('sha256').update(bytes).digest('hex') }),
    );
  }
} finally {
  await browser.close();
}
