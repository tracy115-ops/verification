import { test, expect } from '@playwright/test';

test('keeps conversation controls compact and remembers the task panel visibility', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('本地优先', { exact: true })).toHaveCount(0);
  await expect(page.locator('.app-project')).toHaveCount(0);
  await expect(page.locator('.app-statusbar')).toHaveCount(0);
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

test('resizes the task panel by dragging and keyboard, and restores its width', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto('/');
  const separator = page.getByRole('separator', { name: '调整任务面板宽度' });
  const panel = page.locator('.session-task-empty');
  const initial = (await panel.boundingBox())!.width;
  const handle = (await separator.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 180);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - 120, handle.y + 180, { steps: 12 });
  await page.mouse.up();
  await expect(separator).toHaveAttribute('aria-valuenow', String(initial + 120));
  expect((await panel.boundingBox())!.width).toBe(initial + 120);
  await page.reload();
  expect((await panel.boundingBox())!.width).toBe(initial + 120);
  await separator.focus();
  await page.keyboard.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', String(initial + 96));
  await page.getByRole('button', { name: '展开或收起任务面板' }).click();
  await expect(separator).toHaveCount(0);
  await page.getByRole('button', { name: '展开或收起任务面板' }).click();
  expect((await panel.boundingBox())!.width).toBe(initial + 96);
  await page.setViewportSize({ width: 900, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await separator.focus();
  await page.keyboard.press('Home');
  await expect(separator).toHaveAttribute('aria-valuenow', '280');
  await page.keyboard.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', '280');
});
