import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { WorkflowRun } from '../../src/domain/runtime/types';

test('binds compact assets to the selected conversation without a global task dropdown', async ({ page }) => {
  const original = JSON.parse(
    readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
  ) as WorkflowRun;
  const first = structuredClone(original);
  const second = structuredClone(original);
  first.id = crypto.randomUUID();
  first.sessionId = crypto.randomUUID();
  second.id = crypto.randomUUID();
  second.sessionId = crypto.randomUUID();
  for (const artifact of Object.values(first.artifacts))
    if (artifact.type.startsWith('RequirementBaseline'))
      (artifact.value as { requirements: { text: string }[] }).requirements[0].text = '甲任务独有需求';
  for (const artifact of Object.values(second.artifacts))
    if (artifact.type.startsWith('RequirementBaseline'))
      (artifact.value as { requirements: { text: string }[] }).requirements[0].text = '乙任务独有需求';
  const sessions = [
    { id: first.sessionId, title: '房间创建验证', profileId: 'codex-native', messages: [], runs: [first] },
    { id: second.sessionId, title: '排位权限验证', profileId: 'codex-native', messages: [], runs: [second] },
    { id: crypto.randomUUID(), title: '空白设计会话', profileId: 'codex-native', messages: [], runs: [] },
  ];
  await page.goto('/');
  await page.evaluate((sessions) => {
    localStorage.setItem('verification-workbench.conversations.v1', JSON.stringify(sessions));
    localStorage.setItem('verification-workbench.active-conversation', sessions[0].id);
  }, sessions);
  await page.reload();
  const assets = page.getByRole('button', { name: '验证资产', exact: true });
  await assets.click();
  await expect(page.locator('.assets-context h1')).toHaveText('房间创建验证');
  await expect(page.locator('.assets-list')).toContainText('甲任务独有需求');
  await expect(page.locator('.assets-workspace')).not.toContainText('乙任务独有需求');
  await expect(page.locator('.assets-context select')).toHaveCount(0);
  await expect(page.locator('.app-page-heading')).toHaveCount(0);
  await expect(page.locator('.app-titlebar')).toHaveCount(0);
  expect((await page.locator('.assets-context').boundingBox())!.height).toBeLessThan(85);
  expect((await page.locator('.assets-body').boundingBox())!.y).toBeLessThan(150);
  await page.locator('.session-history-item').filter({ hasText: '排位权限验证' }).click();
  await assets.click();
  await expect(page.locator('.assets-context h1')).toHaveText('排位权限验证');
  await expect(page.locator('.assets-list')).toContainText('乙任务独有需求');
  await expect(page.locator('.assets-workspace')).not.toContainText('甲任务独有需求');
  await page.locator('.session-history-item').filter({ hasText: '空白设计会话' }).click();
  await assets.click();
  await expect(page.getByRole('heading', { name: '当前会话还没有验证任务' })).toBeVisible();
  await expect(page.locator('.assets-list')).toHaveCount(0);
  await page.locator('.assets-context').getByRole('button', { name: '返回对话', exact: true }).click();
  await expect(page.locator('.session-title')).toHaveText('空白设计会话');
  await page.locator('.session-history-item').filter({ hasText: '房间创建验证' }).click();
  await assets.click();
  await page.setViewportSize({ width: 900, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '搜索会话', exact: true }).click();
  const search = page.getByRole('dialog', { name: '搜索会话', exact: true });
  await expect(search.getByRole('heading', { name: '搜索会话', exact: true })).toBeVisible();
  await expect(search.getByRole('searchbox', { name: '搜索会话名称或需求', exact: true })).toBeFocused();
  await search.getByRole('searchbox').fill('maxPlayers');
  await expect(search.locator('.session-search-result')).toHaveCount(2);
  await search.getByRole('searchbox').fill('排位权限');
  await expect(search.locator('.session-search-result')).toHaveCount(1);
  await search.getByRole('button', { name: /排位权限验证/ }).click();
  await expect(search).toHaveCount(0);
  await expect(page.locator('.session-title')).toHaveText('排位权限验证');
  await assets.click();
  await expect(page.locator('.assets-context h1')).toHaveText('排位权限验证');
  await page.getByRole('button', { name: '搜索会话', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(search).toHaveCount(0);
});
