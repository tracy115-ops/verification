import { chromium, expect, test } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

test('creates, reopens and exports a real SQLite copy through the native desktop UI', async () => {
  const endpoint = process.env.DESKTOP_AUDIT_ENDPOINT;
  test.skip(!endpoint, 'Explicit isolated native desktop audit required.');
  const browser = await chromium.connectOverCDP(endpoint!);
  const page = browser.contexts()[0].pages()[0];
  const invoke = async <T>(command: string, args?: Record<string, unknown>) =>
    page.evaluate(
      ({ command, args }) =>
        (
          window as unknown as {
            __TAURI_INTERNALS__: { invoke: (c: string, a?: Record<string, unknown>) => Promise<T> };
          }
        ).__TAURI_INTERNALS__.invoke(command, args),
      { command, args },
    );
  const directory = await invoke<string>('plugin:path|resolve_directory', { directory: 15 });
  const database = path.join(directory, 'personal-shadow-v1.sqlite3');
  const output = path.resolve('.runtime/native-shadow');
  mkdirSync(output, { recursive: true });
  // Never rotate a user's pre-existing copies as part of an audit.
  expect(existsSync(database), 'Use a clean app-local data directory for the shadow audit.').toBe(false);
  try {
    expect(page.url()).toContain('tauri.localhost');
    const version = await invoke<{ currentVersion: string }>('update_status');
    if (process.env.DESKTOP_AUDIT_VERSION)
      expect(version.currentVersion).toBe(process.env.DESKTOP_AUDIT_VERSION);
    await page.locator('.session-history-new').click();
    const original = await page.evaluate(() =>
      localStorage.getItem('verification-workbench.conversations.v1'),
    );
    const open = async () => {
      await page.getByRole('button', { name: '设置', exact: true }).click();
      await page.getByRole('button', { name: '数据管理', exact: true }).click();
    };
    await open();
    const section = page.getByRole('region', { name: '本机数据保护副本' });
    await expect(section).toContainText('尚无数据保护副本');
    await section.getByRole('button', { name: '创建并校验副本' }).click();
    await expect(section.getByRole('status')).toContainText('完整性校验通过');
    expect(existsSync(database)).toBe(true);
    expect(readFileSync(database).subarray(0, 16).toString()).toBe('SQLite format 3\0');
    await page.reload();
    await open();
    await expect(section.getByRole('status')).toContainText('完整性校验通过');
    const download = page.waitForEvent('download');
    await section.getByRole('button', { name: '导出最近副本用于恢复' }).click();
    const file = await (await download).path();
    expect(file).toBeTruthy();
    const backup = JSON.parse(readFileSync(file!, 'utf8'));
    expect(backup.storage['verification-workbench.conversations.v1']).toBe(original);
    expect(await page.evaluate(() => localStorage.getItem('verification-workbench.conversations.v1'))).toBe(
      original,
    );
    // No release was checked/downloaded: every handoff must remain gated here.
    const ready = await invoke<{ ready: boolean }>('update_status');
    expect(ready.ready).toBe(false);
    await expect(invoke('install_update')).rejects.toThrow('update_backup_required');
    const saved = await invoke<{ snapshots: { id: number; sha256: string }[] }>('personal_shadow_status');
    const receipt = { id: saved.snapshots[0].id, sha256: saved.snapshots[0].sha256 };
    await expect(
      invoke('install_update', { backup: { ...receipt, sha256: 'a'.repeat(64) } }),
    ).rejects.toThrow('update_backup_stale');
    await expect(invoke('install_update', { backup: receipt })).rejects.toThrow('update_check_first');
    await section.screenshot({ path: path.join(output, 'desktop-shadow.png') });
    writeFileSync(
      path.join(output, 'summary.json'),
      JSON.stringify(
        {
          version: version.currentVersion,
          originalIpc: true,
          realSqlite: true,
          persistedAfterReload: true,
          exportedSourceMatches: true,
          sourceUnchanged: true,
          missingAndMismatchedBackupRejected: true,
          validBackupPassedToPackageGate: true,
          // Used only for guarded cleanup of the audit-created file.
          auditDatabase: database,
          databaseSha256: createHash('sha256').update(readFileSync(database)).digest('hex'),
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
});
