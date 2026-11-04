import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const spec = 'After five failed attempts, lock the account.';
const requirements = {
  requirements: [
    { id: 'R1', text: spec, quote: spec, acceptanceCriteria: ['Lock after the fifth failure.'] },
  ],
  questions: [],
};
const design = {
  strategy: 'Boundary',
  factors: [
    {
      id: 'F1',
      name: 'Failed attempts',
      requirementIds: ['R1'],
      levels: ['5'],
      sourceQuote: 'five failed attempts',
    },
  ],
  scenarios: [
    {
      id: 'S1',
      title: 'Fifth failure',
      requirementIds: ['R1'],
      dimension: 'boundary',
      expected: 'Locked',
      factorLevels: [{ factorId: 'F1', level: '5' }],
    },
  ],
  gaps: [],
};
const cases = {
  cases: [
    {
      id: 'C1',
      title: 'Lock the account',
      scenarioIds: ['S1'],
      requirementIds: ['R1'],
      preconditions: ['Active account'],
      steps: ['Submit five incorrect passwords'],
      expected: 'Locked',
      assertions: ['Account state is locked'],
    },
  ],
};
const original = {
  spec,
  snapshot: {
    formatVersion: 1,
    revision: 1,
    definition: JSON.parse(readFileSync('docs/examples/general-testing.workflow.json', 'utf8')),
    profiles: [
      {
        id: 'codeagent-native',
        name: 'codeagent',
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
  },
};
const output: Record<string, unknown> = {
  RequirementBaselineDraft: requirements,
  TestDesignDraft: design,
  TestCaseSetDraft: cases,
};

test('resumes design reviews after two-day waits and reloads without repeating completed CLI nodes', async ({
  page,
}) => {
  await page.clock.install({ time: new Date() });
  await page.addInitScript(
    ({ saved, artifacts }) => {
      if (!localStorage.getItem('verification-workbench.document.v1'))
        localStorage.setItem('verification-workbench.document.v1', JSON.stringify(saved));
      Object.assign(globalThis, {
        isTauri: true,
        __TAURI_INTERNALS__: {
          transformCallback: () => 1,
          unregisterCallback: () => {},
          invoke: (command: string, args: { request?: { prompt: string } }) => {
            if (command !== 'send_cli_turn') return Promise.reject('offline_fixture');
            const operation = JSON.parse(args.request!.prompt).operation;
            const types: Record<string, string> = {
              'requirements.extract': 'RequirementBaselineDraft',
              'scenarios.design': 'TestDesignDraft',
              'cases.generate': 'TestCaseSetDraft',
            };
            return Promise.resolve({
              status: 'completed',
              text: JSON.stringify(artifacts[types[operation]]),
              errorCode: null,
              nativeSessionId: null,
            });
          },
        },
      });
    },
    { saved: original.snapshot, artifacts: output },
  );
  await page.goto('/');
  await page.getByRole('combobox', { name: '会话 Agent', exact: true }).selectOption('codeagent-native');
  await page.getByRole('combobox', { name: '已保存流程', exact: true }).selectOption('workflow');
  await page.locator('.session-composer textarea').fill(original.spec);
  await page.getByRole('button', { name: '调用流程', exact: true }).click();
  const panel = page.getByRole('complementary', { name: '流程进度' });
  let previousWait = 0;
  for (let gate = 0; gate < 3; gate++) {
    await expect(panel.getByRole('button', { name: '打开评审工作区', exact: true })).toBeVisible();
    await expect(panel).toContainText('等待人工评审期间暂停流程计时');
    const run = await page.evaluate(
      () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs[0],
    );
    expect(run.approvals).toHaveLength(gate);
    expect(run.reviewPausedAt).toBeTruthy();
    await page.clock.setSystemTime(new Date(Date.parse(run.reviewPausedAt) + 48 * 3600_000));
    await page.reload();
    await panel.getByRole('button', { name: '打开评审工作区', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '确认并继续', exact: true }).click();
    await expect
      .poll(async () => {
        const current = await page.evaluate(
          () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs[0],
        );
        return current.approvals.length;
      })
      .toBe(gate + 1);
    const next = await page.evaluate(
      () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs[0],
    );
    expect(next.reviewWaitMs).toBeGreaterThanOrEqual(previousWait + 48 * 3600_000);
    previousWait = next.reviewWaitMs;
  }
  const run = await page.evaluate(
    () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs[0],
  );
  expect(run.status).toBe('completed');
  expect(run.scope).toBe('design');
  expect(run.reviewPausedAt).toBeUndefined();
  expect(
    run.plan
      .filter((node: { kind: string }) => node.kind === 'agent')
      .map((node: { id: string }) => run.steps[node.id].attempts),
  ).toEqual([1, 1, 1]);
});
