import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { en, zh } from '../../src/shared/i18n/messages';

test('keeps the pending-edit review readable in both locales, themes and desktop sizes', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  mkdirSync('.runtime/product-audit', { recursive: true });
  for (const locale of ['zh-CN', 'en-US'] as const)
    for (const dark of [false, true])
      for (const width of [900, 1500]) {
        const context = await browser.newContext({ viewport: { width, height: 650 } });
        try {
          const page = await context.newPage();
          const t = locale === 'zh-CN' ? zh : en;
          await page.addInitScript(
            ({ locale, dark }) => {
              localStorage.setItem('verification-workbench.appearance.v1', JSON.stringify({ locale, dark }));
            },
            { locale, dark },
          );
          await page.goto(baseURL!);
          await page.locator('.app-settings button').click();
          const nav = page.locator('.settings-navigation');
          await nav.getByRole('button', { name: t.frameworkSettings, exact: true }).click();
          await page
            .getByRole('textbox', { name: t.frameworkName, exact: true })
            .fill('Unfinished framework');
          await nav.getByRole('button', { name: t.agents, exact: true }).click();
          await page
            .locator('.settings-agent-setup:visible .settings-model-row input')
            .fill('unfinished-model');
          await nav.getByRole('button', { name: t.dataManagement, exact: true }).click();
          await page.getByRole('button', { name: t.draftReview, exact: true }).click();
          const dialog = page.getByRole('alertdialog');
          await expect(dialog.locator('li')).toHaveCount(2);
          const bounds = await dialog.evaluate((element) => {
            const r = element.getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              height: r.height,
              overflow: element.scrollWidth - element.clientWidth,
            };
          });
          expect(bounds.left).toBeGreaterThanOrEqual(0);
          expect(bounds.right).toBeLessThanOrEqual(width + 1);
          expect(bounds.height).toBeLessThanOrEqual(650 * 0.8 + 1);
          expect(bounds.overflow).toBeLessThanOrEqual(1);
          await page.screenshot({
            path: `.runtime/product-audit/unsaved-${locale}-${dark ? 'dark' : 'light'}-${width}.png`,
          });
        } finally {
          await context.close();
        }
      }
});
