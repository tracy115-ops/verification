import { chromium, expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { en, zh } from '../../src/shared/i18n/messages';

test('guards an actual native close with a hidden draft and closes after explicit confirmation', async () => {
  test.setTimeout(60_000);
  const endpoint = process.env.DESKTOP_AUDIT_ENDPOINT;
  test.skip(!endpoint, 'An isolated native Release window is required.');
  const browser = await chromium.connectOverCDP(endpoint!);
  const page = browser.contexts()[0].pages()[0];
  const output = '.runtime/native-close';
  mkdirSync(output, { recursive: true });
  try {
    expect(page.url()).toContain('tauri.localhost');
    await expect(page.locator('.app-main')).toHaveAttribute('data-close-protection', 'ready');
    await page.locator('.app-settings button').click();
    await page
      .locator('.settings-navigation')
      .getByRole('button', { name: zh.systemUpdates, exact: true })
      .click();
    const version = (await page.locator('.settings-version-row strong').textContent())!;
    if (process.env.DESKTOP_AUDIT_VERSION) expect(version).toBe(process.env.DESKTOP_AUDIT_VERSION);
    await page.locator('.settings-navigation').getByRole('button', { name: zh.agents, exact: true }).click();
    const model = page.locator('.settings-agent-setup:visible .settings-model-row input');
    await model.fill('native-unsaved-close-audit');
    await page.locator('.app-sidebar > nav').getByRole('button', { name: zh.sessions, exact: true }).click();
    const requestClose = () =>
      page.evaluate(() =>
        (
          window as unknown as {
            __TAURI_INTERNALS__: { invoke: (command: string, args: unknown) => Promise<void> };
          }
        ).__TAURI_INTERNALS__.invoke('plugin:window|close', { label: 'main' }),
      );
    await requestClose();
    let dialog = page.getByRole('alertdialog', { name: zh.draftCloseTitle });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('li')).toHaveCount(1);
    await page.screenshot({ path: `${output}/hidden-draft-close.png` });
    await dialog.getByRole('button', { name: zh.draftKeepWorking }).click();
    await expect(dialog).toHaveCount(0);
    await page.locator('.app-settings button').click();
    await page
      .locator('.settings-navigation')
      .getByRole('button', { name: zh.generalSettings, exact: true })
      .click();
    await page.locator('.settings-theme-options').getByRole('button', { name: zh.dark, exact: true }).click();
    await page.getByRole('combobox', { name: zh.language, exact: true }).selectOption('en-US');
    await requestClose();
    dialog = page.getByRole('alertdialog', { name: en.draftCloseTitle });
    await expect(dialog.locator('li')).toContainText(en.model);
    await expect(dialog.locator('li')).not.toContainText(zh.model);
    await page.screenshot({ path: `${output}/hidden-draft-close-dark-en.png` });
    await dialog.getByRole('button', { name: en.draftReturn }).click();
    await expect(model).toHaveValue('native-unsaved-close-audit');
    await expect(model).toBeFocused();
    await requestClose();
    const closed = page.waitForEvent('close');
    await dialog.getByRole('button', { name: en.draftCloseAnyway }).click();
    await closed;
    writeFileSync(
      `${output}/summary.json`,
      JSON.stringify(
        {
          version,
          originalIpc: true,
          originalNativeWindowClose: true,
          hiddenDraftBlockedClose: true,
          cancelKeptWindowOpen: true,
          exactDraftReturnedWithFocus: true,
          explicitConfirmationClosedWindow: true,
          freshModelCall: false,
          locales: ['zh-CN', 'en-US'],
          themes: ['light', 'dark'],
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close().catch(() => {});
  }
});
