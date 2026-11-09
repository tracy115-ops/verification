import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { DesignArtifact, WorkflowRun } from '../../src/domain/runtime/types';
import { zh, en } from '../../src/shared/i18n/messages';

test('keeps gap decisions and repair controls readable across languages, themes and widths', async ({
  page,
}) => {
  const run = JSON.parse(
    readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
  ) as WorkflowRun;
  const design = Object.values(run.artifacts).find((item) => item.type === 'TestDesign')!
    .value as DesignArtifact;
  design.scenarios[0].factorLevels = [];
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
                  title: 'Quality review layout',
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
        await page.getByRole('button', { name: t.matrixTitle, exact: true }).click();
        const quality = page.locator('.design-quality');
        await expect(quality.getByRole('button', { name: t.qualityRepair })).toBeVisible();
        for (const label of [t.qualityOpen, t.qualityPending, t.qualityDecided])
          await quality.getByRole('button', { name: new RegExp(`^${label} ·`) }).click();
        const bounds = await quality.boundingBox();
        for (const button of await quality.getByRole('button').all()) {
          const box = (await button.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(bounds!.x);
          expect(box.x + box.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.screenshot({ path: `.runtime/quality-${locale}-${dark ? 'dark' : 'light'}-${width}.png` });
      }
});
