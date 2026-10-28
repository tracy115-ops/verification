import { expect, test } from '@playwright/test';

test('renames conversations, cancels deletion and persists deletion with selection fallback', async ({
  page,
}) => {
  await page.goto('/');
  const create = page.locator('.session-history-new');
  await create.click();
  await create.click();
  const rows = page.locator('.session-history-row');
  await rows.first().getByRole('button', { name: '会话操作' }).click();
  await page.getByRole('button', { name: '重命名会话', exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: '会话名称' }).fill('边界与权限验证');
  await dialog.getByRole('button', { name: '保存名称' }).click();
  await expect(rows.first().locator('.session-history-item')).toHaveText('边界与权限验证');
  await expect(page.locator('.session-title')).toHaveText('边界与权限验证');
  await page.reload();
  await expect(rows.first().locator('.session-history-item')).toHaveText('边界与权限验证');
  await expect(page.locator('.session-title')).toHaveText('边界与权限验证');
  await rows.first().locator('.session-history-item').click();
  await rows.first().getByRole('button', { name: '会话操作' }).click();
  await page.getByRole('button', { name: '删除会话', exact: true }).filter({ visible: true }).click();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(rows).toHaveCount(2);
  await rows.first().getByRole('button', { name: '会话操作' }).click();
  await page.getByRole('button', { name: '删除会话', exact: true }).filter({ visible: true }).click();
  await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(page.locator('.session-title')).toHaveText('新会话');
  await page.reload();
  await expect(rows).toHaveCount(1);
  await rows.first().getByRole('button', { name: '会话操作' }).click();
  await page.getByRole('button', { name: '删除会话', exact: true }).filter({ visible: true }).click();
  await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(rows).toHaveCount(0);
  await expect(page.locator('.session-welcome')).toBeVisible();
});
