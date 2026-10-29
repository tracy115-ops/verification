import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { WorkflowRun } from '../../src/domain/runtime/types';

test('filters attention runs, opens node artifacts and binds assets to the exact historical invocation', async ({
  page,
}) => {
  // Offline recorded design fixture; statuses below exercise UI recovery, not actual model failures.
  const original = JSON.parse(
    readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
  ) as WorkflowRun;
  const old = structuredClone(original);
  old.id = crypto.randomUUID();
  old.createdAt = '2026-10-27T00:00:00Z';
  for (const item of Object.values(old.artifacts))
    if (item.type.startsWith('RequirementBaseline'))
      (item.value as { requirements: { text: string }[] }).requirements[0].text = '历史运行特有需求';
  const latest = structuredClone(original);
  latest.id = crypto.randomUUID();
  latest.createdAt = '2026-10-28T00:00:00Z';
  const failed = structuredClone(original);
  failed.id = crypto.randomUUID();
  failed.sessionId = crypto.randomUUID();
  failed.status = 'failed';
  failed.errorCode = 'cli_failed';
  const step = failed.plan.find((node) => node.operation === 'scenarios.design')!;
  failed.steps[step.id].status = 'failed';
  await page.goto('/');
  await page.evaluate(
    ({ old, latest, failed }) => {
      localStorage.setItem(
        'verification-workbench.conversations.v1',
        JSON.stringify([
          {
            id: old.sessionId,
            title: '边界验证',
            profileId: 'codex-native',
            messages: [],
            runs: [old, latest],
          },
          {
            id: failed.sessionId,
            title: '待处理验证',
            profileId: 'codex-native',
            messages: [],
            runs: [failed],
          },
        ]),
      );
    },
    { old, latest, failed },
  );
  await page.reload();
  await page.getByRole('button', { name: '运行实例', exact: true }).click();
  await expect(page.locator('.run-record')).toHaveCount(3);
  await page.getByLabel('筛选运行状态', { exact: true }).selectOption('attention');
  await expect(page.locator('.run-record')).toHaveCount(1);
  await expect(page.locator('.run-details')).toContainText('CLI');
  await expect(page.locator('.run-current')).toContainText('测试设计与场景映射');
  await expect(page.getByRole('button', { name: '去会话处理', exact: true })).toBeVisible();
  await page.getByLabel('筛选运行状态', { exact: true }).selectOption('all');
  await page.getByRole('searchbox', { name: '搜索会话、流程名称或运行 ID', exact: true }).fill(old.id);
  await expect(page.locator('.run-record')).toHaveCount(1);
  await expect(page.locator('.run-details')).toContainText(old.id);
  await expect(page.locator('.run-details')).toContainText('未记录');
  await page.setViewportSize({ width: 900, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.locator('.run-details').getByText('需求理解', { exact: true }).click();
  await page.locator('.run-details .session-step-artifact').filter({ hasText: '4 条需求' }).first().click();
  const dialog = page.getByRole('dialog', { name: '步骤产物', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('历史运行特有需求');
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await page.locator('.run-details').getByRole('button', { name: '验证资产', exact: true }).click();
  await expect(page.locator('.assets-context')).toContainText('历史运行版本');
  await expect(page.locator('.assets-list')).toContainText('历史运行特有需求');
});
