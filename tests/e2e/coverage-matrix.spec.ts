import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('traces task coverage and opens linked cases without counting declarations as execution', async ({
  page,
}) => {
  const run = JSON.parse(readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'));
  await page.goto('/');
  await page.evaluate(
    (run) =>
      localStorage.setItem(
        'verification-workbench.conversations.v1',
        JSON.stringify([
          {
            id: run.sessionId,
            title: 'Matrix fixture',
            profileId: 'codex-native',
            messages: [],
            runs: [run],
          },
        ]),
      ),
    run,
  );
  await page.reload();
  await page.getByRole('button', { name: '验证资产', exact: true }).click();
  await page.getByRole('button', { name: '覆盖矩阵', exact: true }).click();
  const matrix = page.getByRole('region', { name: '覆盖矩阵' });
  await expect(matrix.locator('tbody tr')).toHaveCount(4);
  await matrix.getByRole('checkbox').check();
  await expect(matrix.locator('tbody tr')).toHaveCount(4);
  await matrix.getByRole('textbox').fill('no-matching-requirement');
  await expect(matrix.locator('tbody tr')).toHaveCount(0);
  await matrix.getByRole('textbox').fill('');
  await page.screenshot({ path: '.runtime/coverage-matrix.png' });
  await page.setViewportSize({ width: 900, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await matrix.locator('tbody tr').first().locator('td').nth(3).getByRole('button').first().click();
  await expect(page.locator('.personal-case-coverage')).toBeVisible();
});
