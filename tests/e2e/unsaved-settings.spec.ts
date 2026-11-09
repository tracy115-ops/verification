import { expect, test, type Page } from '@playwright/test';
import { en, zh } from '../../src/shared/i18n/messages';

async function settings(page: Page, tab: string) {
  await page.locator('.app-settings button').click();
  await page.locator('.settings-navigation').getByRole('button', { name: tab, exact: true }).click();
}
async function protectedUnload(page: Page) {
  return page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

test('translates pending-edit labels after switching language without rewriting the draft', async ({
  page,
}) => {
  await page.goto('/');
  await settings(page, zh.agents);
  await page.locator('.settings-agent-setup:visible .settings-model-row input').fill('locale-switch-model');
  await settings(page, zh.generalSettings);
  await page.getByRole('combobox', { name: zh.language, exact: true }).selectOption('en-US');
  await page
    .locator('.settings-navigation')
    .getByRole('button', { name: en.dataManagement, exact: true })
    .click();
  await page.getByRole('button', { name: en.draftReview }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.locator('li')).toContainText(en.model);
  await expect(dialog.locator('li')).not.toContainText(zh.model);
  await dialog.getByRole('button', { name: en.draftReturn }).click();
  await expect(page.locator('.settings-agent-setup:visible .settings-model-row input')).toHaveValue(
    'locale-switch-model',
  );
});

test('protects hidden settings edits, locates their exact form, and unblocks data actions after save/discard', async ({
  page,
}) => {
  await page.goto('/');
  await settings(page, zh.frameworkSettings);
  const frame = page.locator('.settings-framework-form:visible');
  const name = frame.getByRole('textbox', { name: zh.frameworkName, exact: true });
  const original = await name.inputValue();
  await name.fill('Unsaved framework name');
  await settings(page, zh.agents);
  const model = page.locator('.settings-agent-setup:visible .settings-model-row input');
  await model.fill('draft-test-model');
  await page.locator('.app-sidebar > nav').getByRole('button', { name: zh.sessions, exact: true }).click();
  expect(await protectedUnload(page)).toBe(true);
  await settings(page, zh.dataManagement);
  await expect(page.getByRole('button', { name: zh.dataReset, exact: true })).toBeDisabled();
  await page.getByRole('button', { name: zh.draftReview, exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: zh.draftReview });
  await expect(dialog.locator('li')).toHaveCount(2);
  await dialog
    .locator('li')
    .filter({ hasText: 'codex / native' })
    .getByRole('button', { name: zh.draftReturn })
    .click();
  await expect(model).toHaveValue('draft-test-model');
  await expect(model).toBeFocused();
  await page
    .locator('.settings-agent-setup:visible')
    .getByRole('button', { name: zh.saveModel, exact: true })
    .click();
  await settings(page, zh.dataManagement);
  await page.getByRole('button', { name: zh.draftReview }).click();
  await expect(dialog.locator('li')).toHaveCount(1);
  await dialog.getByRole('button', { name: zh.draftDiscard }).click();
  await dialog.getByRole('button', { name: zh.draftKeepWorking }).click();
  await expect(page.getByRole('button', { name: zh.dataReset, exact: true })).toBeEnabled();
  expect(await protectedUnload(page)).toBe(false);
  await settings(page, zh.frameworkSettings);
  await expect(name).toHaveValue(original);
});

test('keeps a model draft when saving fails and clears protection only after successful persistence', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    let fail = true;
    window.addEventListener('allow-profile-save', () => {
      fail = false;
    });
    Storage.prototype.setItem = function (key, value) {
      if (fail && key === 'verification-workbench.profiles.v1') throw new Error('fixture_storage_full');
      original.call(this, key, value);
    };
  });
  await page.goto('/');
  await settings(page, zh.agents);
  const model = page.locator('.settings-agent-setup:visible .settings-model-row input');
  await model.fill('retained-after-failure');
  const save = page
    .locator('.settings-agent-setup:visible')
    .getByRole('button', { name: zh.saveModel, exact: true });
  await save.click();
  await expect(model).toHaveValue('retained-after-failure');
  expect(await protectedUnload(page)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('allow-profile-save')));
  await save.click();
  expect(await protectedUnload(page)).toBe(false);
  await page.reload();
  await settings(page, zh.agents);
  await expect(model).toHaveValue('retained-after-failure');
});

test('saving a model preserves the separate unsaved CLI path and allows discarding that path alone', async ({
  page,
}) => {
  await page.goto('/');
  await settings(page, zh.agents);
  const instance = page.locator('.settings-agent-setup:visible .settings-native-instance');
  await instance.locator(':scope > summary').click();
  await instance.locator('.settings-instance-advanced > summary').click();
  const path = instance.getByRole('textbox', { name: zh.cliExecutablePath, exact: true });
  await path.fill('D:\\Fixture Tools\\codex.cmd');
  await page
    .locator('.settings-agent-setup:visible .settings-model-row input')
    .fill('saved-model-with-pending-path');
  await page
    .locator('.settings-agent-setup:visible')
    .getByRole('button', { name: zh.saveModel, exact: true })
    .click();
  await expect(path).toHaveValue('D:\\Fixture Tools\\codex.cmd');
  expect(await protectedUnload(page)).toBe(true);
  await settings(page, zh.dataManagement);
  await page.getByRole('button', { name: zh.draftReview }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.locator('li')).toHaveCount(1);
  await expect(dialog.locator('li')).toContainText(zh.cliInstance);
  await dialog.getByRole('button', { name: zh.draftReturn }).click();
  await instance.getByRole('button', { name: zh.draftDiscard }).click();
  await expect(path).toHaveValue('');
  await expect(page.locator('.settings-agent-setup:visible .settings-model-row input')).toHaveValue(
    'saved-model-with-pending-path',
  );
  expect(await protectedUnload(page)).toBe(false);
});

test('a real browser reload can be cancelled without losing the draft', async ({ page }) => {
  await page.goto('/');
  await settings(page, zh.agents);
  const model = page.locator('.settings-agent-setup:visible .settings-model-row input');
  await model.fill('cancelled-reload-draft');
  const question = page.waitForEvent('dialog');
  const reloading = page.reload({ timeout: 2000 }).catch(() => null);
  const dialog = await question;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  await reloading;
  await expect(model).toHaveValue('cancelled-reload-draft');
  await page.locator('.settings-agent-setup:visible').getByRole('button', { name: zh.draftDiscard }).click();
  expect(await protectedUnload(page)).toBe(false);
});

for (const action of ['discard', 'edit'] as const)
  test(`a late framework file does not override a newer ${action}`, async ({ page }) => {
    await page.addInitScript(() => {
      const original = File.prototype.text;
      File.prototype.text = function () {
        if (this.name === 'delayed.py')
          return new Promise((resolve) =>
            window.addEventListener('finish-file-read', () => resolve('# late file'), { once: true }),
          );
        return original.call(this);
      };
    });
    await page.goto('/');
    await settings(page, zh.frameworkSettings);
    const source = page.getByRole('textbox', { name: zh.frameworkSource, exact: true });
    const original = await source.inputValue();
    await page
      .locator('.settings-framework-form input[type=file]')
      .setInputFiles({ name: 'delayed.py', mimeType: 'text/x-python', buffer: Buffer.from('# delayed') });
    expect(await protectedUnload(page)).toBe(true);
    if (action === 'edit') {
      await source.fill('# newer manual input');
      await page.evaluate(() => window.dispatchEvent(new Event('finish-file-read')));
      await expect(source).toHaveValue('# newer manual input');
      await expect(page.getByRole('button', { name: zh.saveFramework, exact: true })).toBeEnabled();
      expect(await protectedUnload(page)).toBe(true);
      return;
    }
    await settings(page, zh.dataManagement);
    await page.getByRole('button', { name: zh.draftReview }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: zh.draftDiscard }).click();
    await dialog.getByRole('button', { name: zh.draftKeepWorking }).click();
    await page.evaluate(() => window.dispatchEvent(new Event('finish-file-read')));
    await settings(page, zh.frameworkSettings);
    await expect(source).toHaveValue(original);
    expect(await protectedUnload(page)).toBe(false);
  });
