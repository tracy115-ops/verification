import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

test('saves framework settings and selects the full workflow without exposing browser execution', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '测试框架与执行', exact: true }).click();
  const form = page.locator('.settings-framework-form');
  await form.getByRole('textbox', { name: '框架名称', exact: true }).fill('题目 SDK（本地验证）');
  await form.getByRole('textbox', { name: '被测接口基础地址', exact: true }).fill('http://127.0.0.1:4321');
  await form.getByRole('spinbutton', { name: '测试执行超时（秒）', exact: true }).fill('90');
  const folder = testInfo.outputPath('python-sdk');
  await mkdir(path.join(folder, 'sdk'), { recursive: true });
  await writeFile(path.join(folder, 'framework.py'), 'from sdk.client import BlackBoxCase\n');
  await writeFile(path.join(folder, 'sdk/client.py'), 'from unittest import TestCase as BlackBoxCase\n');
  await form.getByLabel('导入 SDK 目录（framework.py 和 sdk/）').setInputFiles(folder);
  await expect(form.getByLabel('framework.py 源码')).toHaveValue('from sdk.client import BlackBoxCase\n');
  await form.getByRole('button', { name: '保存框架与目标', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('配置已保存到设置');
  await page.reload();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '测试框架与执行', exact: true }).click();
  await expect(form.getByRole('textbox', { name: '框架名称', exact: true })).toHaveValue(
    '题目 SDK（本地验证）',
  );
  await expect(form.getByRole('spinbutton', { name: '测试执行超时（秒）', exact: true })).toHaveValue('90');
  await form.getByText('SDK 模块 · 1').click();
  await expect(form.getByText('sdk/client.py')).toBeVisible();
  await page.screenshot({ path: '.runtime/framework-settings.png', fullPage: true });
  await page.getByRole('button', { name: '流程编排', exact: true }).click();
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await page.getByRole('button', { name: 'CLI 会话', exact: true }).click();
  await page.getByLabel('已保存流程').selectOption('workflow');
  const scope = page.getByRole('combobox', { name: '本次调用范围', exact: true });
  await scope.selectOption({ label: '需求 → Python → 本地执行与分析 · 题目 SDK（本地验证）' });
  await expect(scope.locator('option:checked')).toContainText('需求 → Python');
  await expect(page.locator('.session-scope')).toHaveCount(0);
  await page.screenshot({ path: '.runtime/composer-workflow.png' });
  await page.getByRole('textbox').fill('游戏对战平台题目：根据外部接口验证房间容量和积分规则。');
  await expect(page.getByRole('button', { name: '调用流程', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});
