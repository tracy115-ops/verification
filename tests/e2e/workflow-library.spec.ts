import { expect, test } from '@playwright/test';

test('creates, switches, copies, renames and deletes workflows without replacing the original', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '流程编排', exact: true }).click();
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await page.getByRole('button', { name: '流程库', exact: true }).click();
  let dialog = page.getByRole('alertdialog', { name: '流程库' });
  await dialog.getByRole('button', { name: '新建流程', exact: true }).click();
  await dialog.getByLabel('新流程名称').fill('支付状态与重放验证');
  await dialog.getByRole('button', { name: '创建并打开' }).click();
  await expect(page.getByRole('heading', { name: /支付状态与重放验证/ })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '流程编排', exact: true }).click();
  await expect(page.getByRole('heading', { name: /支付状态与重放验证/ })).toBeVisible();
  await page.getByRole('button', { name: '流程库', exact: true }).click();
  await dialog.getByRole('button', { name: '复制当前流程' }).click();
  await dialog.getByLabel('新流程名称').fill('支付快速回归');
  await dialog.getByRole('button', { name: '创建并打开' }).click();
  await page.locator('.workflow-metadata summary').click();
  await page.getByLabel('流程名称', { exact: true }).fill('支付快速回归 v2');
  await page.getByRole('button', { name: '流程库', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '新建流程', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: '保存草稿', exact: true }).click();
  await dialog.getByRole('textbox', { name: '搜索流程名称或 ID' }).fill('支付');
  await expect(dialog.locator('.workflow-library-list li')).toHaveCount(2);
  await page.screenshot({ path: '.runtime/workflow-library-light.png' });
  await dialog.getByRole('button', { name: '删除当前流程', exact: true }).click();
  await dialog.getByRole('button', { name: '确认删除模板' }).click();
  await expect(dialog.locator('.workflow-library-list li')).toHaveCount(1);
  await dialog.getByRole('button', { name: /支付状态与重放验证 v0.2.0/ }).click();
  await page.getByRole('button', { name: 'CLI 会话', exact: true }).click();
  await expect(page.getByLabel('已保存流程').locator('option')).toContainText([
    '普通对话',
    '支付状态与重放验证',
    '测试设计验证流程',
  ]);
});

test('remembers workflow choice per session even when the editor switches workflows', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '流程编排', exact: true }).click();
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await page.getByRole('button', { name: '流程库', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: '流程库' });
  await dialog.getByRole('button', { name: '新建流程', exact: true }).click();
  await dialog.getByLabel('新流程名称').fill('权限回归');
  await dialog.getByRole('button', { name: '创建并打开' }).click();
  await page.getByRole('button', { name: 'CLI 会话', exact: true }).click();
  await page.getByLabel('已保存流程').selectOption('general-testing');
  await expect(page.getByLabel('已保存流程').locator('option:checked')).toContainText('测试设计验证流程');
  await page.reload();
  await expect(page.getByLabel('已保存流程').locator('option:checked')).toContainText('测试设计验证流程');
  await page.getByRole('button', { name: '流程编排', exact: true }).click();
  await expect(page.getByRole('heading', { name: /权限回归/ })).toBeVisible();
});

test('renames through the library and keeps its controls reachable in a narrow dark English window', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByLabel('界面语言').selectOption('en-US');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.setViewportSize({ width: 900, height: 700 });
  await page.getByRole('button', { name: 'Workflow designer', exact: true }).click();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.getByRole('button', { name: 'Workflow library', exact: true }).click();
  let dialog = page.getByRole('alertdialog', { name: 'Workflow library' });
  await dialog.getByRole('button', { name: 'Rename current workflow' }).click();
  await dialog.getByLabel('Workflow name', { exact: true }).fill('Permissions and recovery');
  await dialog.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Permissions and recovery/ })).toBeVisible();
  await page.getByRole('button', { name: 'Workflow library', exact: true }).click();
  await expect(dialog.locator('.workflow-library-list li')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Close workflow library' })).toBeInViewport();
  await page.screenshot({ path: '.runtime/workflow-library-dark-en-narrow.png' });
  await dialog.getByRole('button', { name: 'Close workflow library' }).click();
});
