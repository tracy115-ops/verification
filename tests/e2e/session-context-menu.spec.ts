import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { WorkflowRun } from '../../src/domain/runtime/types';

test('opens the clicked conversation assets through context and overflow menus without switching early', async ({
  page,
}) => {
  const run = JSON.parse(
    readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
  ) as WorkflowRun;
  const sessions = ['当前会话', '右键目标会话'].map((title) => {
    const sessionId = crypto.randomUUID();
    return {
      id: sessionId,
      title,
      profileId: 'codex-native',
      messages: [],
      runs: [{ ...run, id: crypto.randomUUID(), sessionId }],
    };
  });
  await page.goto('/');
  await page.evaluate((sessions) => {
    localStorage.setItem('verification-workbench.conversations.v1', JSON.stringify(sessions));
    localStorage.setItem('verification-workbench.active-conversation', sessions[0].id);
  }, sessions);
  await page.reload();
  const row = page.locator('.session-history-row').filter({ hasText: '右键目标会话' });
  const menu = page.locator('.session-history-menu:popover-open');
  await row.locator('.session-history-item').click({ button: 'right' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button')).toHaveCount(3);
  await expect(page.locator('.session-title')).toHaveText('当前会话');
  await menu.getByRole('button', { name: '验证资产', exact: true }).click();
  await expect(page.locator('.assets-context h1')).toHaveText('右键目标会话');
  await expect(page.locator('.assets-item')).toHaveCount(4);
  await row.getByRole('button', { name: '会话操作', exact: true }).click();
  await expect(menu.getByRole('button', { name: '验证资产', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await row.locator('.session-history-item').focus();
  await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: '重命名会话', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('会话名称', { exact: true }).fill('右键重命名结果');
  await dialog.getByRole('button', { name: '保存名称', exact: true }).click();
  await expect(page.locator('.assets-context h1')).toHaveText('右键重命名结果');
  const renamed = page.locator('.session-history-row').filter({ hasText: '右键重命名结果' });
  const size = page.viewportSize()!;
  await renamed.dispatchEvent('contextmenu', { clientX: size.width - 1, clientY: size.height - 1 });
  const rect = (await menu.boundingBox())!;
  expect(rect.x + rect.width).toBeLessThanOrEqual(size.width);
  expect(rect.y + rect.height).toBeLessThanOrEqual(size.height);
  await menu.getByRole('button', { name: '删除会话', exact: true }).click();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(renamed).toBeVisible();
  await renamed.click({ button: 'right' });
  await page.locator('.assets-context h1').click();
  await expect(menu).toHaveCount(0);
});
