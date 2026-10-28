import { expect, test } from '@playwright/test';

test('floats operation feedback without shifting content and clears it on navigation', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: '流程编排', exact: true }).click();
  const before = (await page.locator('.app-content').boundingBox())!.y;
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  const toast = page.locator('.wb-toast');
  await expect(toast).toContainText('草稿已保存到当前设备');
  expect((await page.locator('.app-content').boundingBox())!.y).toBe(before);
  await expect(page.locator('.app-notice')).toHaveCount(0);
  await page.clock.fastForward(4100);
  await expect(toast).toHaveCount(0);
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(toast).toBeVisible();
  await page.getByRole('button', { name: 'CLI 会话', exact: true }).click();
  await expect(toast).toHaveCount(0);
  await expect(page.locator('.app-validation-errors')).toHaveCount(0);
});
