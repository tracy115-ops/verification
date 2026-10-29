import { expect, test } from '@playwright/test';

test('uses left navigation and performs an update through progress and confirmation', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (command: string, args?: { onEvent: { onmessage: (v: unknown) => void } }) => {
          const release = {
            version: '9.0.0',
            notes: 'Fixture release notes',
            publishedAt: '2026-10-29T00:00:00Z',
            releaseUrl: 'https://github.com/tracy115-ops/verification/releases/tag/v9.0.0',
            size: 1024,
          };
          const base = {
            currentVersion: '0.2.0',
            supported: true,
            release: null,
            ready: false,
            proxyMode: 'system',
          };
          if (command === 'update_status') return base;
          if (command === 'check_update') return { ...base, release };
          if (command === 'download_update') {
            args!.onEvent.onmessage({ downloaded: 512, total: 1024 });
            return { ...base, release, ready: true };
          }
          if (command === 'install_update') {
            localStorage.setItem('fixture-install', 'started');
            return;
          }
          if (command === 'cancel_update') return;
          if (command === 'read_logs')
            return [
              {
                name: 'workbench.log',
                bytes: 32,
                text: '{"event":"cli.diagnostic","details":{"exit_code":21,"reason":"cli_trust_required"}}\n',
              },
            ];
          if (command === 'clear_logs') return;
          throw new Error('unexpected_fixture_command');
        },
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const nav = page.getByRole('navigation', { name: '设置', exact: true });
  await nav.getByRole('button', { name: '在线升级', exact: true }).click();
  await page.getByRole('button', { name: '检查更新', exact: true }).click();
  await expect(page.getByText('发现新版本 · 9.0.0')).toBeVisible();
  await page.getByRole('button', { name: '下载更新', exact: true }).click();
  await expect(page.getByText('安装包已校验，可安装')).toBeVisible();
  await page.getByRole('button', { name: '安装并重启', exact: true }).click();
  const confirm = page.getByRole('alertdialog', { name: '安装并重启' });
  await confirm.getByRole('button', { name: '安装并重启' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('fixture-install'))).toBe('started');
  await nav.getByRole('button', { name: '诊断日志', exact: true }).click();
  await expect(page.locator('.settings-log-text')).toContainText('cli_trust_required');
  const navBox = (await nav.boundingBox())!;
  const content = (await page.locator('.settings-content').boundingBox())!;
  expect(navBox.x + navBox.width).toBeLessThanOrEqual(content.x + 1);
  await page.screenshot({ path: '.runtime/settings-diagnostics.png' });
});

test('backs up, clears and restores personal data through confirmation', async ({ page }) => {
  await page.goto('/');
  await page.locator('.session-history-new').click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '数据管理', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出个人数据' }).click();
  const saved = await download;
  const filePath = await saved.path();
  expect(filePath).toBeTruthy();
  await page.getByRole('button', { name: '清空个人数据' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.locator('.session-history-row')).toHaveCount(0);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '数据管理', exact: true }).click();
  await page.locator('.settings-system-panel input[type=file]').setInputFiles(filePath!);
  await page.getByRole('alertdialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.locator('.session-history-row')).toHaveCount(1);
});
