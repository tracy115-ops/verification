import { expect, test, type Page } from '@playwright/test';
import { installRestoreFixture } from './shadow-restore-fixture';
import { zh, en } from '../../src/shared/i18n/messages';

async function openData(page: Page, t: typeof en = zh) {
  await page.getByRole('button', { name: t.settings, exact: true }).click();
  await page.getByRole('button', { name: t.dataManagement, exact: true }).click();
  await expect(page.locator('.settings-shadow').getByRole('radio')).toHaveCount(2);
}
async function preview(page: Page, id: number, t: typeof en = zh) {
  const section = page.locator('.settings-shadow');
  await section.locator(`input[type=radio][value="${id}"]`).check();
  await section.getByRole('button', { name: t.shadowRestorePreview, exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: t.shadowRestoreTitle })).toBeVisible();
}
async function source(page: Page) {
  try {
    return await page.evaluate(() => localStorage.getItem('verification-workbench.conversations.v1'));
  } catch {
    return null;
  }
}

test('previews without writes, restores an older copy after rotation, and restores the safety copy to undo', async ({
  page,
}) => {
  // Offline UI/IndexedDB contract; actual SQLite round trip is a separate native audit.
  const data = await installRestoreFixture(page);
  await page.goto('/');
  await openData(page);
  await preview(page, 1);
  await expect(page.getByRole('alertdialog')).toContainText('完整替换');
  expect(await source(page)).toBe(data.original);
  expect(await page.evaluate(() => sessionStorage.getItem('restore.saves'))).toBeNull();
  await page.getByRole('alertdialog').getByRole('button', { name: zh.cancelAction, exact: true }).click();
  await preview(page, 1);
  await page.getByRole('alertdialog').getByRole('button', { name: zh.shadowRestoreConfirm }).click();
  await expect.poll(() => source(page)).toBe(data.target);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await openData(page);
  await expect(page.locator('.settings-shadow input[value="1"]')).toHaveCount(0);
  await preview(page, 3);
  await page.getByRole('alertdialog').getByRole('button', { name: zh.shadowRestoreConfirm }).click();
  await expect.poll(() => source(page)).toBe(data.original);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('restore.saves'))).toBe('2');
});

test('keeps current data when the mandatory safety copy fails and shows the failure in the dialog', async ({
  page,
}) => {
  const data = await installRestoreFixture(page);
  await page.goto('/');
  await openData(page);
  await preview(page, 1);
  await page.evaluate(() => sessionStorage.setItem('restore.failSave', '1'));
  await page.getByRole('alertdialog').getByRole('button', { name: zh.shadowRestoreConfirm }).click();
  await expect(page.getByRole('alertdialog').getByRole('alert')).toContainText('未能保护当前数据');
  expect(await source(page)).toBe(data.original);
  expect(await page.evaluate(() => sessionStorage.getItem('restore.saves'))).toBeNull();
});

test('keeps restoration previews readable in narrow light/dark Chinese and English windows', async ({
  page,
}) => {
  await installRestoreFixture(page);
  await page.setViewportSize({ width: 900, height: 650 });
  await page.goto('/');
  for (const locale of ['zh-CN', 'en-US'])
    for (const dark of [false, true]) {
      const t = locale === 'zh-CN' ? zh : en;
      await page.evaluate(
        ({ locale, dark }) =>
          localStorage.setItem('verification-workbench.appearance.v1', JSON.stringify({ locale, dark })),
        { locale, dark },
      );
      await page.reload();
      await openData(page, t);
      await preview(page, 1, t);
      const dialog = page.getByRole('alertdialog');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: `.runtime/restore-${locale}-${dark ? 'dark' : 'light'}-900.png` });
      await dialog.getByRole('button', { name: t.cancelAction, exact: true }).click();
    }
});
