import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { WorkflowRun, DesignArtifact, RequirementArtifact } from '../../src/domain/runtime/types';

const original = JSON.parse(
  readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
) as WorkflowRun;

test('brings a specific gap into the conversation and invalidates reordered downstream nodes only after proposal approval', async ({
  page,
}) => {
  const run = structuredClone(original);
  run.plan.reverse();
  const design = Object.values(run.artifacts).find((item) => item.type === 'TestDesign')!
    .value as DesignArtifact;
  const scenario = structuredClone(design.scenarios[0]);
  design.scenarios[0].factorLevels = [];
  const patch = {
    summary: '补齐已有边界场景的因子映射',
    factors: [],
    scenarios: [{ action: 'update', value: scenario }],
    questions: [],
  };
  await page.addInitScript(
    ({ run, patch }) => {
      if (!localStorage.getItem('verification-workbench.conversations.v1'))
        localStorage.setItem(
          'verification-workbench.conversations.v1',
          JSON.stringify([
            {
              id: run.sessionId,
              title: '缺口补充闭环',
              profileId: 'codeagent-native',
              messages: [],
              runs: [run],
              draft: {
                text: '请保留我的原备注',
                invoke: false,
                profileId: 'codeagent-native',
                frameworkId: '',
                useNodeBindings: false,
                contextMode: 'recent',
              },
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
              text: JSON.stringify(patch),
              errorCode: null,
              nativeSessionId: null,
            };
          },
        },
      });
    },
    { run, patch },
  );
  await page.goto('/');
  await page.getByRole('button', { name: '验证资产', exact: true }).click();
  await page.getByRole('button', { name: '覆盖矩阵', exact: true }).click();
  await page.locator('.design-quality').getByRole('button', { name: '围绕这些缺口补充设计' }).click();
  const input = page.locator('.session-composer textarea');
  await expect(input).toHaveValue(/请保留我的原备注[\s\S]*F1/);
  await expect(page.getByRole('button', { name: '生成修改提议', exact: true })).toBeVisible();
  const current = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs[0],
    );
  expect((await current()).approvals).toEqual(original.approvals);
  await page.getByRole('button', { name: '生成修改提议', exact: true }).click();
  await page
    .getByRole('complementary', { name: '流程进度' })
    .getByRole('button', { name: '查看提议差异' })
    .click();
  const dialog = page.getByRole('dialog', { name: '查看提议差异', exact: true });
  await dialog.getByRole('button', { name: '合入并重新评审' }).click();
  await expect(dialog).toContainText('已合入，后续需要重新评审');
  const revised = await current();
  expect(revised.approvals).toHaveLength(1);
  expect(
    Object.values(revised.artifacts).some(
      (item: unknown) => (item as { type: string }).type === 'TestCaseSet',
    ),
  ).toBe(false);
  for (const node of run.plan.filter((item) => ['cases.generate', 'review.cases'].includes(item.operation)))
    expect(revised.steps[node.id]).toEqual({ status: 'pending', attempts: 0 });
  expect(revised.artifacts['history.design.1'].value.artifacts).toMatchObject(run.artifacts);
  expect(
    Object.values(revised.artifacts['history.design.1'].value.artifacts).some(
      (item: unknown) =>
        (item as { type: string; value?: { status: string } }).type === 'DesignChangeProposal' &&
        (item as { value: { status: string } }).value.status === 'pending',
    ),
  ).toBe(true);
  await page.screenshot({ path: '.runtime/design-repair-approved.png' });
});

test('separates clarified and excluded findings from cases awaiting generation', async ({ page }) => {
  const run = structuredClone(original);
  const baseline = Object.values(run.artifacts).find((item) => item.type === 'RequirementBaseline')!
    .value as RequirementArtifact;
  const question = '恢复状态由哪个外部接口观察？';
  baseline.questions = [question];
  run.clarifications = [{ question, answer: '由约定的查询接口观察。', recordedAt: new Date().toISOString() }];
  for (const [key, artifact] of Object.entries(run.artifacts))
    if (['TestCaseSet', 'TestCaseSetDraft'].includes(artifact.type)) delete run.artifacts[key];
  await page.addInitScript(
    (run) =>
      localStorage.setItem(
        'verification-workbench.conversations.v1',
        JSON.stringify([
          {
            id: run.sessionId,
            title: '评审状态分类',
            profileId: 'codeagent-native',
            messages: [],
            runs: [run],
          },
        ]),
      ),
    run,
  );
  await page.goto('/');
  await page.getByRole('button', { name: '验证资产', exact: true }).click();
  await page.getByRole('button', { name: '覆盖矩阵', exact: true }).click();
  const quality = page.locator('.design-quality');
  await quality.getByRole('button', { name: /待处理 · 0/ }).click();
  await expect(quality.locator('.design-quality-findings li')).toHaveCount(0);
  await quality.getByRole('button', { name: /待生成 · 4/ }).click();
  await expect(quality.locator('.design-quality-findings li')).toHaveCount(4);
  await quality.getByRole('button', { name: /已处理 · 2/ }).click();
  await expect(quality).toContainText('由约定的查询接口观察。');
  await expect(quality).toContainText('已记录排除原因');
  await expect(quality).toContainText('有用例的场景 · 0 / 4');
  await page.screenshot({ path: '.runtime/design-quality-decisions.png' });
});
