import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { CaseArtifact, WorkflowRun } from '../../src/domain/runtime/types';

const original = JSON.parse(
  readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
) as WorkflowRun;
const cases = Object.values(original.artifacts).find((item) => item.type === 'TestCaseSet')!
  .value as CaseArtifact;
for (const unanswered of [false, true])
  test(`reviews case proposals before changing cases; unanswered=${unanswered}`, async ({ page }) => {
    const output = unanswered
      ? { summary: '需要明确规则', cases: [], questions: ['未说明重复提交的预期'] }
      : {
          summary: '明确已有用例的状态码断言',
          cases: [{ action: 'update', value: { ...cases.cases[0], assertions: ['response.status == 201'] } }],
          questions: [],
        };
    await page.addInitScript(
      ({ run, output }) => {
        if (!localStorage.getItem('verification-workbench.conversations.v1'))
          localStorage.setItem(
            'verification-workbench.conversations.v1',
            JSON.stringify([
              {
                id: run.sessionId,
                title: '用例增量提议',
                profileId: 'codeagent-native',
                messages: [],
                runs: [run],
              },
            ]),
          );
        Object.assign(globalThis, {
          isTauri: true,
          __TAURI_INTERNALS__: {
            transformCallback: () => 1,
            unregisterCallback: () => {},
            invoke: async (command: string) => {
              if (command !== 'send_cli_turn') throw new Error('offline_fixture');
              return {
                status: 'completed',
                text: JSON.stringify(output),
                errorCode: null,
                nativeSessionId: null,
              };
            },
          },
        });
      },
      { run: original, output },
    );
    await page.goto('/');
    const panel = page.getByRole('complementary', { name: '流程进度' });
    await panel.getByRole('button', { name: '让 Agent 补充用例', exact: true }).click();
    await page.locator('.session-composer textarea').fill('核对现有容量 2 用例的可观察状态码断言');
    await page.getByRole('button', { name: '生成用例修改提议', exact: true }).click();
    await expect(page.locator('.session-composer textarea')).toHaveValue('');
    await panel.getByRole('button', { name: '查看用例提议差异', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '查看用例提议差异' });
    const apply = dialog.getByRole('button', { name: '合入并重新评审' });
    const current = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs[0],
      );
    expect((await current()).approvals).toEqual(original.approvals);
    if (unanswered) {
      await expect(dialog).toContainText('未说明重复提交的预期');
      await expect(apply).toBeDisabled();
      await dialog.getByRole('button', { name: '暂不采纳' }).click();
      expect((await current()).approvals).toEqual(original.approvals);
    } else {
      await expect(dialog).toContainText('response.status == 201');
      await apply.click();
      await expect(dialog).toContainText('已合入，后续需要重新评审');
      const run = await current();
      expect(run.approvals).toHaveLength(2);
      expect(run.artifacts['history.cases.1'].value.source).toBe('agent_approved');
      expect(
        Object.values(run.artifacts).some(
          (item: unknown) => (item as { type: string }).type === 'TestDesign',
        ),
      ).toBe(true);
      await page.screenshot({ path: '.runtime/case-proposal-approved.png' });
    }
  });
