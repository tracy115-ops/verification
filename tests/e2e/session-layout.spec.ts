import { test, expect } from '@playwright/test';

test('keeps conversation controls compact and remembers the task panel visibility', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.locator('.session-conversation').getByRole('button', { name: '新建会话', exact: true }),
  ).toHaveCount(0);
  await page.locator('.session-history-new').click();
  await expect(page.locator('.session-history-list .session-history-item')).toHaveCount(1);
  const toggle = page.getByRole('button', { name: '展开或收起任务面板' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.session-task-empty')).toBeVisible();
  await expect(page.locator('.session-workflow-shortcut')).toHaveCount(0);
  await toggle.click();
  await expect(page.locator('.session-task-empty')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.session-history-list .session-history-item')).toHaveCount(1);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(page.locator('.session-task-empty')).toBeVisible();
  await page.setViewportSize({ width: 900, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
