import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('edits a node profile and restores its saved draft after reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '流程编排', exact: true }).click();
  await expect(page.locator('.workflow-node')).toHaveCount(13);
  await page.screenshot({ path: '.runtime/workflow-overview.png' });
  await page.getByRole('combobox', { name: 'Agent 配置', exact: true }).selectOption('claude-native');
  await page.getByRole('spinbutton', { name: '超时（秒）', exact: true }).fill('450');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('草稿已保存到当前设备');
  await page.reload();
  await page.getByRole('button', { name: '流程编排', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Agent 配置', exact: true })).toHaveValue('claude-native');
  await expect(page.getByRole('spinbutton', { name: '超时（秒）', exact: true })).toHaveValue('450');
  expect(errors).toEqual([]);
});

test('adds a human review and validates it without invoking an Agent', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '流程编排', exact: true }).click();
  await page.getByRole('button', { name: '添加人工复核', exact: true }).click();
  await expect(page.locator('.workflow-node')).toHaveCount(14);
  await expect(page.locator('.workflow-inspector')).toContainText('无需 Agent CLI');
  await page.getByRole('button', { name: '检查流程', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('定义检查通过');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
});

test('keeps candidate coverage separate from execution results', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '验证资产', exact: true }).click();
  await page.getByRole('button', { name: '需求与场景', exact: true }).click();
  const strip = page.locator('.review-status-strip');
  await expect(strip).toContainText('场景缺失');
  await page.getByRole('button', { name: '添加示例候选', exact: true }).click();
  await expect(strip).toContainText('待确认');
  await expect(strip).not.toContainText('场景缺失');
  await page.getByRole('button', { name: '确认示例映射', exact: true }).click();
  await expect(page.locator('.review-inspector')).toContainText('已确认映射');
  await expect(strip).toContainText('待确认');
  await expect(strip).toContainText('未运行');
});

test('switches language and theme and explains the browser CLI boundary', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByLabel('界面语言').selectOption('en-US');
  await expect(page.getByRole('button', { name: 'General', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Agents & providers', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Detect installed CLIs', exact: true })).toBeDisabled();
  await expect(page.locator('.settings-shell')).toContainText('Browser mode');
  await page.screenshot({ path: '.runtime/agents-dark.png' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('rejects a malformed import and keeps the current graph', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '流程编排', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"formatVersion":99}'),
  });
  await expect(page.getByRole('status')).toContainText('导入失败');
  await expect(page.locator('.workflow-node')).toHaveCount(13);
  await page.screenshot({ path: '.runtime/workflow-light.png' });
});

test('exports and imports a renamed workflow with its configuration', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '流程编排', exact: true }).click();
  await page.locator('.workflow-metadata summary').click();
  await page.getByRole('textbox', { name: '流程名称', exact: true }).fill('接口冒烟验证');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const download = await downloadPromise;
  const file = await download.path();
  expect(file).not.toBeNull();
  const text = await readFile(file!, 'utf8');
  const exported = JSON.parse(text);
  expect(exported.definition.name).toBe('接口冒烟验证');
  expect(exported.definition.nodes).toHaveLength(13);
  exported.definition.name = '导入的冒烟验证';
  await page.locator('input[type=file]').setInputFiles({
    name: 'workflow.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('导入的冒烟验证');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
});

test('adds a provider profile and binds it to an Agent node', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: 'Agent 与 Provider', exact: true }).first().click();
  await page.getByRole('textbox', { name: '配置名称', exact: true }).fill('企业网关（测试）');
  await page.getByRole('textbox', { name: '模型 ID', exact: true }).fill('model-example');
  await page.getByRole('textbox', { name: 'Provider 地址', exact: true }).fill('https://example.invalid/v1');
  await page.getByRole('textbox', { name: '凭据引用', exact: true }).fill('env:TEST_PROVIDER_KEY');
  await page.getByRole('button', { name: '新建 Provider 配置', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('配置已保存到设置');
  await page.reload();
  await page.getByRole('button', { name: '流程编排', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Agent 配置', exact: true })
    .selectOption({ label: '企业网关（测试）' });
  await expect(page.locator('.workflow-profile-summary')).toContainText('openai-responses');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
});

test('keeps navigation accessible and avoids page overflow in a narrow window', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 780 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '设置', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 640, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('opens conversations first and selects only saved workflow revisions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CLI 会话', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '发送消息', exact: true })).toBeDisabled();
  await page.screenshot({ path: '.runtime/conversations-light.png' });
  await page.getByRole('button', { name: '流程编排', exact: true }).click();
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await page.getByRole('button', { name: 'CLI 会话', exact: true }).click();
  await page.getByLabel('已保存流程').selectOption('workflow');
  await expect(page.locator('.session-scope')).toContainText('需求 → 场景 → 用例评审');
  await expect(page.getByRole('button', { name: '调用设计流程', exact: true })).toBeDisabled();
  await page.getByLabel('流程编排', { exact: true }).click();
  await page.getByRole('spinbutton', { name: '超时（秒）', exact: true }).fill('450');
  await page.getByRole('button', { name: 'CLI 会话', exact: true }).click();
  await page.getByLabel('已保存流程').selectOption('workflow');
  await expect(page.locator('.session-scope')).toContainText('上次保存版本');
});
