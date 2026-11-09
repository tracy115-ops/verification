import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { WorkflowRun } from '../../src/domain/runtime/types';
import { createSession } from '../../src/domain/runtime/chat';

test('exposes missing factor levels and scenarios, with a direct path to supplement the design', async ({
  page,
}) => {
  const session = createSession('codex-native');
  session.title = '登录锁定的边界与恢复';
  const run = JSON.parse(
    readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
  ) as WorkflowRun;
  const requirements = {
    requirements: [{ id: 'REQ-1', text: '失败5次锁定', quote: '失败5次', acceptanceCriteria: ['第5次锁定'] }],
    questions: [],
  };
  const design = {
    strategy: '边界验证',
    factors: [
      { id: 'F-1', name: '失败次数', requirementIds: ['REQ-1'], levels: ['5'], sourceQuote: '失败5次' },
    ],
    scenarios: [
      {
        id: 'SC-1',
        title: '第五次失败',
        requirementIds: ['REQ-1'],
        dimension: 'boundary',
        expected: '锁定',
        factorLevels: [{ factorId: 'F-1', level: '5' }],
      },
    ],
    gaps: [],
  };
  const cases = {
    cases: [
      {
        id: 'TC-1',
        title: '失败锁定',
        scenarioIds: ['SC-1'],
        requirementIds: ['REQ-1'],
        preconditions: [],
        steps: ['失败5次'],
        expected: '锁定',
        assertions: ['标记锁定'],
      },
    ],
  };
  run.sessionId = session.id;
  run.status = 'completed';
  run.artifacts = {
    requirements: { type: 'RequirementBaseline', digest: 'r', value: requirements },
    design: {
      type: 'TestDesign',
      digest: 'd',
      value: {
        ...design,
        factors: [{ ...design.factors[0], levels: ['4', '5', '6'] }],
        scenarios: [
          ...design.scenarios,
          {
            ...design.scenarios[0],
            id: 'SC-2',
            title: '锁定后继续尝试',
            factorLevels: [{ factorId: 'F-1', level: '6' }],
          },
        ],
        gaps: ['解锁后的计数重置规则尚未明确'],
      },
    },
    cases: { type: 'TestCaseSet', digest: 'c', value: cases },
  };
  session.runs = [run];
  await page.addInitScript(
    (value) => localStorage.setItem('verification-workbench.conversations.v1', JSON.stringify([value])),
    session,
  );
  await page.goto('/');
  await page.getByRole('button', { name: '验证资产', exact: true }).click();
  await page.getByRole('button', { name: '覆盖矩阵', exact: true }).click();
  const quality = page.locator('.design-quality');
  await expect(quality).toContainText('有场景的因子水平 · 2 / 3');
  await expect(quality).toContainText('有用例的场景 · 1 / 2');
  await expect(quality).toContainText('解锁后的计数重置规则尚未明确');
  await page.screenshot({ path: '.runtime/design-quality-light.png' });
  await quality.getByRole('button', { name: 'F-1 · 失败次数 · 4' }).click();
  await expect(page.locator('.assets-detail')).toContainText('失败次数');
});
