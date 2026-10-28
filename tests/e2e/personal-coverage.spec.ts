import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { WorkflowRun } from '../../src/domain/runtime/types';

test('persists manual case declarations separately from execution and exports a safe handoff package', async ({
  page,
}) => {
  // Recorded task fixture only; this test does not call a model or execute tests.
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
          title: 'Coverage interaction fixture',
          profileId: 'codex-native',
          messages: [],
          runs: [run],
        },
      ]),
    );
  }, run);
  await page.reload();
  await page.getByRole('button', { name: '验证资产', exact: true }).click();
  await page.getByRole('button', { name: '测试用例', exact: true }).click();
  const coverage = page.locator('.personal-case-coverage');
  await expect(coverage).toContainText('未关联脚本');
  await coverage.getByLabel('声明此用例已有脚本覆盖', { exact: true }).check();
  await coverage
    .getByLabel('脚本位置／方法及核对说明', { exact: true })
    .fill('test_cases.py::test_boundary（仅人工声明，尚未核对）');
  await coverage.getByRole('button', { name: '保存覆盖声明', exact: true }).click();
  await expect(coverage).toContainText('已声明覆盖');
  await expect(coverage).toContainText('尚未执行／无匹配证据');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出协作补充包', exact: true }).click(),
  ]);
  const bundle = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(bundle.kind).toBe('workflow-contribution');
  expect(bundle.cases.cases.length).toBe(4);
  expect(bundle.profiles).toBeUndefined();
  expect(bundle.executionProfile).toBeUndefined();
  await page.reload();
  await page.getByRole('button', { name: '验证资产', exact: true }).click();
  await page.getByRole('button', { name: '测试用例', exact: true }).click();
  await expect(coverage).toContainText('已声明覆盖');
  await coverage.getByLabel('声明此用例已有脚本覆盖', { exact: true }).uncheck();
  await coverage.getByRole('button', { name: '保存覆盖声明', exact: true }).click();
  await expect(coverage).toContainText('未关联脚本');
});
