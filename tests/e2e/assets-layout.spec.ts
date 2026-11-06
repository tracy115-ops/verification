import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('keeps every English asset tab reachable with wider font metrics in narrow windows', async ({
  page,
}) => {
  const run = JSON.parse(readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'));
  await page.addInitScript((run) => {
    localStorage.setItem(
      'verification-workbench.appearance.v1',
      JSON.stringify({ locale: 'en-US', dark: false }),
    );
    localStorage.setItem(
      'verification-workbench.conversations.v1',
      JSON.stringify([
        {
          id: run.sessionId,
          title: 'Asset layout check',
          profileId: 'codex-native',
          messages: [],
          runs: [run],
        },
      ]),
    );
    localStorage.setItem('verification-workbench.active-conversation', run.sessionId);
  }, run);
  await page.goto('/');
  await page.getByRole('button', { name: 'Verification assets', exact: true }).click();
  // Stress font metrics rather than assuming Windows and Linux resolve identical fonts.
  await page.addStyleTag({
    content: '.assets-tabs > button { font-family: Arial, sans-serif; font-size: 16px; }',
  });
  const tabs = page.locator('.assets-workspace > .assets-tabs');
  for (const width of [760, 900]) {
    await page.setViewportSize({ width, height: 780 });
    const bounds = await tabs.boundingBox();
    for (const button of await tabs.getByRole('button').all()) {
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(bounds!.x);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
    }
    await tabs.getByRole('button', { name: 'Coverage matrix', exact: true }).click();
    await expect(page.locator('.coverage-matrix')).toBeVisible();
    await tabs.getByRole('button').first().click();
    await expect(page.locator('.coverage-matrix')).toHaveCount(0);
  }
});
