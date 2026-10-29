import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { WorkflowRun } from '../../src/domain/runtime/types';

test('adds a factor and scenario manually, preserves history and reopens review after reload', async ({
  page,
}) => {
  // Recorded design fixture; no inference or script execution in this UI regression.
  const run = JSON.parse(
    readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
  ) as WorkflowRun;
  await page.goto('/');
  await page.evaluate((run) => {
    localStorage.setItem(
      'verification-workbench.conversations.v1',
      JSON.stringify([
        {
          id: run.sessionId,
          title: 'Human design fixture',
          profileId: 'codex-native',
          messages: [],
          runs: [run],
        },
      ]),
    );
  }, run);
  await page.reload();
  await page.getByRole('button', { name: '验证资产', exact: true }).click();
  await page.getByRole('button', { name: '测试因子', exact: true }).click();
  await page.getByRole('button', { name: '人工新增', exact: true }).click();
  const editor = page.locator('dialog[open]');
  await editor.getByLabel('ID', { exact: true }).fill('F_HUMAN');
  await editor.getByLabel('名称', { exact: true }).fill('人工容量边界补充');
  await editor.getByRole('checkbox').first().check();
  await editor.getByLabel('因子水平（每行一项）', { exact: true }).fill('人工待确认水平');
  await editor
    .getByRole('button', { name: /^原文依据 ·/ })
    .first()
    .click();
  await editor.getByLabel('修改说明', { exact: true }).fill('补充遗漏边界');
  await editor.getByRole('button', { name: '保存并重新评审', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.assets-list')).toContainText('人工容量边界补充');
  await page.getByRole('button', { name: '场景设计与映射', exact: true }).click();
  await page.getByRole('button', { name: '人工新增', exact: true }).click();
  await editor.getByLabel('ID', { exact: true }).fill('S_HUMAN');
  await editor.getByLabel('名称', { exact: true }).fill('人工补充场景');
  await editor.getByRole('checkbox').first().check();
  await editor.getByLabel('测试维度', { exact: true }).fill('边界分析');
  await editor.getByLabel('预期结果', { exact: true }).fill('待根据需求进一步核对');
  await editor.getByLabel('F_HUMAN · 人工容量边界补充', { exact: true }).selectOption('人工待确认水平');
  await editor.getByLabel('修改说明', { exact: true }).fill('人工补充');
  await editor.getByRole('button', { name: '保存并重新评审', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: '验证资产', exact: true }).click();
  await page.getByRole('button', { name: '场景设计与映射', exact: true }).click();
  await expect(page.locator('.assets-list')).toContainText('人工补充场景');
  const saved: WorkflowRun = await page.evaluate(
    () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs[0],
  );
  expect(saved.status).toBe('awaiting_review');
  expect(saved.artifacts['history.design.2'].value).toMatchObject({ source: 'human' });
  expect(Object.values(saved.artifacts).some((item) => item.type === 'TestCaseSet')).toBe(false);
});
