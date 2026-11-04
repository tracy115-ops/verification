import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('shows indirect cases without counting them as direct requirement coverage', async ({ page }) => {
  const run = JSON.parse(readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'));
  const requirements = {
    requirements: ['R1', 'R2'].map((id) => ({ id, text: id, quote: id, acceptanceCriteria: [id] })),
    questions: [],
  };
  run.artifacts = {
    requirements: { type: 'RequirementBaseline', digest: 'offline', value: requirements },
    design: {
      type: 'TestDesign',
      digest: 'offline',
      value: {
        strategy: 'Offline matrix UI fixture',
        factors: [],
        scenarios: [
          {
            id: 'S1',
            title: 'Shared scenario',
            requirementIds: ['R1', 'R2'],
            dimension: 'state',
            expected: 'Documented result',
            factorLevels: [],
          },
        ],
        gaps: [],
      },
    },
    cases: {
      type: 'TestCaseSet',
      digest: 'offline',
      value: {
        cases: [
          {
            id: 'C1',
            title: 'Only R1 is directly mapped',
            requirementIds: ['R1'],
            scenarioIds: ['S1'],
            preconditions: [],
            steps: ['Call API'],
            expected: 'Documented result',
            assertions: ['Check response'],
          },
        ],
      },
    },
  };
  await page.addInitScript(
    ({ run }) => {
      if (!localStorage.getItem('verification-workbench.conversations.v1')) {
        localStorage.setItem(
          'verification-workbench.conversations.v1',
          JSON.stringify([
            {
              id: run.sessionId,
              title: '覆盖语义验证',
              profileId: 'codex-native',
              messages: [],
              runs: [run],
            },
          ]),
        );
      }
    },
    { run },
  );
  await page.goto('/');
  await page.getByRole('button', { name: '验证资产', exact: true }).click();
  await page.getByRole('button', { name: '覆盖矩阵', exact: true }).click();
  const direct = page.getByRole('row').filter({ hasText: 'R1 · R1' });
  const indirect = page.getByRole('row').filter({ hasText: 'R2 · R2' });
  await expect(direct).toContainText('未关联独立因子');
  await expect(direct).toContainText('未运行: 1');
  await expect(indirect).toContainText('经场景间接关联（不计入统计） · 1');
  await expect(indirect).toContainText('通过: 0 / 0');
  await indirect.locator('summary').click();
  await indirect.getByRole('button', { name: 'C1', exact: true }).click();
  await expect(page.locator('.assets-detail')).toContainText('Only R1 is directly mapped');
});
