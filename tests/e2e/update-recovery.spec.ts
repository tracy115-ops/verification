import { expect, test } from '@playwright/test';

for (const mode of ['failure', 'cancel', 'escape'] as const) {
  test(`stops installer handoff during backup preparation: ${mode}`, async ({ page }) => {
    // Offline handoff contract; no installer or model is launched.
    await page.addInitScript((mode) => {
      const release = {
        version: '9.0.0',
        notes: 'fixture',
        publishedAt: '2026-11-08T00:00:00Z',
        releaseUrl: 'https://github.com/tracy115-ops/verification/releases/tag/v9.0.0',
        size: 1,
      };
      Object.assign(globalThis, {
        isTauri: true,
        __TAURI_INTERNALS__: {
          transformCallback: () => 1,
          unregisterCallback: () => {},
          invoke: async (command: string, args?: { payload?: string }) => {
            if (command === 'update_status')
              return { currentVersion: '0.10.0', supported: true, ready: true, release };
            if (command === 'cancel_update') return;
            if (command === 'update_network_settings')
              return { config: { mode: 'system', address: '' }, source: 'system' };
            if (command === 'install_update') {
              sessionStorage.setItem('recovery.installed', 'yes');
              return;
            }
            if (command === 'save_personal_shadow') {
              if (mode === 'failure') throw 'shadow_unavailable';
              const bytes = new TextEncoder().encode(args!.payload!);
              const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
                b.toString(16).padStart(2, '0'),
              ).join('');
              const result = {
                schemaVersion: 1,
                snapshots: [
                  {
                    id: 1,
                    sha256,
                    bytes: bytes.length,
                    createdAt: JSON.parse(args!.payload!).createdAt,
                    sessions: 0,
                    transcripts: 0,
                  },
                ],
              };
              return new Promise((resolve) =>
                Object.assign(globalThis, { finishUpdateBackup: () => resolve(result) }),
              );
            }
            throw 'offline_fixture';
          },
        },
      });
    }, mode);
    await page.goto('/');
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '在线升级', exact: true }).click();
    await page.getByRole('button', { name: '安装并重启', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('先保存并校验');
    await dialog.getByRole('button', { name: '安装并重启', exact: true }).click();
    if (mode === 'failure') {
      await expect(page.getByRole('alert')).toContainText('未启动安装器');
      await expect(page.getByRole('alert')).toContainText('无法读写保护副本');
    } else {
      await expect(dialog.getByRole('status')).toContainText('正在创建并校验');
      await page.screenshot({ path: `.runtime/update-backup-${mode}.png` });
      if (mode === 'escape') await page.keyboard.press('Escape');
      else await dialog.getByRole('button', { name: '取消', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('status')).toContainText('安装已取消');
      await page.evaluate(() =>
        (globalThis as unknown as { finishUpdateBackup: () => void }).finishUpdateBackup(),
      );
      await expect(page.getByRole('button', { name: '安装并重启', exact: true })).toBeEnabled();
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(page.getByRole('status')).toContainText('工作台继续运行');
    }
    expect(await page.evaluate(() => sessionStorage.getItem('recovery.installed'))).toBeNull();
  });
}
