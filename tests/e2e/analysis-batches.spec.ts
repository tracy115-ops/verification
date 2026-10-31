import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { WorkflowRun } from '../../src/domain/runtime/types';

test('submits a large Spec through the composer and resumes persisted batches after timeout and reload', async ({
  page,
}) => {
  // Only the native CLI boundary is deterministic; the UI creates and drives the task.
  const definition = JSON.parse(readFileSync('docs/examples/general-testing.workflow.json', 'utf8'));
  const saved = {
    formatVersion: 1,
    revision: 1,
    definition,
    profiles: [
      {
        id: 'codeagent-native',
        name: 'CodeAgent fixture',
        driver: 'codeagent',
        protocol: 'native',
        model: '',
        baseUrl: '',
        credentialRef: '',
      },
    ],
    bindings: {},
    layout: {},
    nodeTitles: {},
  };
  const spec = Array.from(
    { length: 8 },
    (_, i) => `## 子系统${i}\n接口${i}容量必须为2到8。\n${'背景说明和完整原始中文。'.repeat(160)}\n`,
  ).join('');
  await page.addInitScript(
    ({ saved }) => {
      if (!localStorage.getItem('verification-workbench.document.v1'))
        localStorage.setItem('verification-workbench.document.v1', JSON.stringify(saved));
      Object.assign(globalThis, {
        isTauri: true,
        __TAURI_INTERNALS__: {
          transformCallback: () => 1,
          unregisterCallback: () => {},
          invoke: async (command: string, args: { request: { prompt: string } }) => {
            if (command === 'cancel_cli_turn') return;
            if (command !== 'send_cli_turn') return Promise.reject('offline_fixture');
            const task = JSON.parse(args.request.prompt);
            const batch = task.analysisBatch;
            if (!batch || task.operation !== 'requirements.extract') return Promise.reject('unexpected_task');
            const calls: number[] = JSON.parse(sessionStorage.getItem('analysis-test-calls') ?? '[]');
            calls.push(batch.index);
            sessionStorage.setItem('analysis-test-calls', JSON.stringify(calls));
            if (batch.index === 2 && !sessionStorage.getItem('analysis-test-failed')) {
              sessionStorage.setItem('analysis-test-failed', 'true');
              return {
                status: 'timed_out',
                text: '',
                errorCode: 'cli_timeout_after_init',
                nativeSessionId: null,
              };
            }
            const requirements = [...String(task.sourceSpec).matchAll(/接口(\d+)容量必须为2到8。/g)].map(
              ([quote, id]) => ({
                id: `Q${id}`,
                text: `接口${id}容量约束`,
                quote,
                acceptanceCriteria: ['合法容量成功，非法容量拒绝'],
              }),
            );
            return {
              status: 'completed',
              text: JSON.stringify({ requirements, questions: [] }),
              errorCode: null,
              nativeSessionId: null,
            };
          },
        },
      });
    },
    { saved },
  );
  await page.goto('/');
  await page.getByRole('combobox', { name: '已保存流程', exact: true }).selectOption('workflow');
  await page.locator('.session-composer textarea').fill(spec);
  await page.getByRole('button', { name: '调用流程', exact: true }).click();
  const panel = page.getByRole('complementary', { name: '流程进度' });
  await expect(panel.getByRole('button', { name: '重试当前节点', exact: true })).toBeVisible();
  await expect(page.locator('.session-step-list').first()).toContainText('已保存批次: 1 /');
  await page.reload();
  await panel.getByRole('button', { name: '重试当前节点', exact: true }).click();
  await expect(panel.getByRole('button', { name: '打开评审工作区', exact: true })).toBeVisible();
  const result = (await page.evaluate(() => {
    const sessions = JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!);
    return { run: sessions[0].runs[0], calls: JSON.parse(sessionStorage.getItem('analysis-test-calls')!) };
  })) as { run: WorkflowRun; calls: number[] };
  const node = result.run.plan.find((item) => item.operation === 'requirements.extract')!;
  const progress = result.run.steps[node.id].analysis!;
  expect(progress.completed).toHaveLength(progress.total);
  expect(result.calls.filter((index) => index === 1)).toHaveLength(1);
  expect(result.calls.filter((index) => index === 2)).toHaveLength(2);
  expect(result.run.approvals).toHaveLength(0);
  expect(result.run.status).toBe('awaiting_review');
  await page.screenshot({ path: '.runtime/analysis-batches.png' });
});
