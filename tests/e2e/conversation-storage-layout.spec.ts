import { expect, test } from '@playwright/test';
import { storageFixture } from './conversation-storage.fixture';
import { zh, en } from '../../src/shared/i18n/messages';

test('keeps migration confirmation readable in both languages, themes and window widths', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await storageFixture(page);
  for (const locale of ['zh-CN', 'en-US'] as const)
    for (const dark of [false, true])
      for (const width of [900, 1500]) {
        const t = locale === 'zh-CN' ? zh : en;
        await page.goto('/');
        await page.evaluate(
          ({ locale, dark }) =>
            localStorage.setItem('verification-workbench.appearance.v1', JSON.stringify({ locale, dark })),
          { locale, dark },
        );
        await page.setViewportSize({ width, height: 700 });
        await page.reload();
        await page.getByRole('button', { name: t.settings, exact: true }).click();
        await page.getByRole('button', { name: t.dataManagement, exact: true }).click();
        await page.getByRole('button', { name: t.storeInspect, exact: true }).click();
        const dialog = page.getByRole('alertdialog', { name: t.storePreview });
        await expect(dialog).toContainText(t.storeNew);
        const bounds = (await dialog.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        const button = (await dialog.getByRole('button', { name: t.storeActivate }).boundingBox())!;
        expect(button.y + button.height).toBeLessThanOrEqual(700);
        await page.screenshot({
          path: `.runtime/store-migration-${locale}-${dark ? 'dark' : 'light'}-${width}.png`,
        });
        await dialog.getByRole('button', { name: t.cancelAction, exact: true }).click();
      }
});
