import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { zh, en } from '../../src/shared/i18n/messages';

const run = JSON.parse(readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'));
test('checks all case editor steps across languages, themes and window widths', async ({ page }) => {
  test.setTimeout(90_000);
  for (const locale of ['zh-CN', 'en-US'] as const)
    for (const dark of [false, true])
      for (const width of [900, 1500]) {
        const t = locale === 'zh-CN' ? zh : en;
        await page.goto('/');
        await page.evaluate(
          ({ run, locale, dark }) => {
            localStorage.setItem('verification-workbench.appearance.v1', JSON.stringify({ locale, dark }));
            localStorage.setItem(
              'verification-workbench.conversations.v1',
              JSON.stringify([
                {
                  id: run.sessionId,
                  title: 'Case editor layout',
                  profileId: 'codeagent-native',
                  messages: [],
                  runs: [run],
                },
              ]),
            );
          },
          { run, locale, dark },
        );
        await page.setViewportSize({ width, height: 780 });
        await page.reload();
        await page.getByRole('button', { name: t.assetsTitle, exact: true }).click();
        await page.getByRole('button', { name: t.caseItems, exact: true }).click();
        await page.getByRole('button', { name: t.caseEdit, exact: true }).click();
        const editor = page.getByRole('dialog', { name: t.caseEditor });
        for (const [index, label] of [t.caseLinks, t.caseStepsTab, t.caseReviewTab].entries()) {
          await editor.getByRole('button', { name: `${index + 1} · ${label}` }).click();
          const bounds = (await editor.boundingBox())!;
          const save = await editor.getByRole('button', { name: t.caseSave, exact: true }).boundingBox();
          expect(save).not.toBeNull();
          expect(save!.y + save!.height).toBeLessThanOrEqual(780);
          expect(save!.y).toBeGreaterThanOrEqual(bounds.y);
          for (const control of await editor.locator('button, input, select, textarea').all()) {
            const box = await control.boundingBox();
            if (!box) continue;
            expect(box.x).toBeGreaterThanOrEqual(bounds.x);
            expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
          }
          await page.screenshot({
            path: `.runtime/case-editor-${locale}-${dark ? 'dark' : 'light'}-${width}-${index + 1}.png`,
          });
        }
        await editor.getByRole('button', { name: t.caseKeepClose }).click();
      }
});
