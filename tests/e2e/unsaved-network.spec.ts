import { expect, test } from '@playwright/test';
import { zh } from '../../src/shared/i18n/messages';

test('retains proxy edits across unmount, blocks installation and cannot discard a running save', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let config = { mode: 'system', address: '' };
    let saves = 0;
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (command: string, args?: { config: typeof config }) => {
          if (command === 'update_network') return { config, source: 'none' };
          if (command === 'cancel_update') return;
          if (command === 'update_status')
            return {
              currentVersion: '0.10.4',
              supported: true,
              ready: true,
              release: {
                version: '9.0.0',
                notes: 'Fixture',
                publishedAt: '2026-11-08T00:00:00Z',
                releaseUrl: 'https://github.com/tracy115-ops/verification/releases/tag/v9.0.0',
                size: 100,
              },
            };
          if (command === 'save_update_network') {
            if (++saves === 1) throw 'update_proxy_failed';
            await new Promise((resolve) =>
              window.addEventListener('finish-network-save', resolve, { once: true }),
            );
            config = args!.config;
            return { config, source: 'manual' };
          }
          throw new Error('offline_fixture');
        },
      },
    });
  });
  await page.goto('/');
  await page.locator('.app-settings button').click();
  const tabs = page.locator('.settings-navigation');
  await tabs.getByRole('button', { name: zh.systemUpdates, exact: true }).click();
  await page.locator('.settings-update-network > summary').click();
  await page.getByRole('combobox', { name: zh.updateProxyMode, exact: true }).selectOption('manual');
  const address = page.getByRole('textbox', { name: zh.updateProxyAddress, exact: true });
  await address.fill('http://127.0.0.1:7890');
  const install = page.getByRole('button', { name: zh.installUpdate, exact: true });
  await expect(install).toBeDisabled();
  await tabs.getByRole('button', { name: zh.generalSettings, exact: true }).click();
  await tabs.getByRole('button', { name: zh.systemUpdates, exact: true }).click();
  await page.locator('.settings-update-network > summary').click();
  await expect(address).toHaveValue('http://127.0.0.1:7890');
  const save = page.getByRole('button', { name: zh.updateProxySave, exact: true });
  await save.click();
  await expect(address).toHaveValue('http://127.0.0.1:7890');
  await expect(page.locator('.settings-update-network')).toContainText(zh.update_proxy_failed);
  await save.click();
  await tabs.getByRole('button', { name: zh.dataManagement, exact: true }).click();
  await page.getByRole('button', { name: zh.draftReview }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('button', { name: zh.draftDiscard })).toBeDisabled();
  await expect(dialog).toContainText(zh.draftSaving);
  await page.evaluate(() => window.dispatchEvent(new Event('finish-network-save')));
  await expect(dialog.locator('li')).toHaveCount(0);
  await dialog.getByRole('button', { name: zh.draftKeepWorking }).click();
  await tabs.getByRole('button', { name: zh.systemUpdates, exact: true }).click();
  await expect(install).toBeEnabled();
});
