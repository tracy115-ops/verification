import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('shows the rejected factor and sends source feedback on explicit retry after reload', async ({
  page,
}) => {
  // Offline UI/IPC regression. The native quota audit uses actual inference separately.
  const definition = JSON.parse(readFileSync('docs/examples/general-testing.workflow.json', 'utf8'));
  await page.addInitScript((definition) => {
    if (!localStorage.getItem('verification-workbench.document.v1'))
      localStorage.setItem(
        'verification-workbench.document.v1',
        JSON.stringify({
          formatVersion: 1,
          revision: 1,
          definition,
          bindings: {},
          layout: {},
          nodeTitles: {},
          profiles: [
            {
              id: 'codex-native',
              name: 'codex',
              driver: 'codex',
              protocol: 'native',
              model: 'fixture',
              baseUrl: '',
              credentialRef: '',
            },
          ],
        }),
      );
    const spec = '账户连续失败5次后锁定。';
    const requirements = {
      requirements: [{ id: 'R1', text: spec, quote: spec, acceptanceCriteria: ['第5次失败锁定'] }],
      questions: [],
    };
    const design = {
      strategy: '边界验证',
      factors: [{ id: 'F1', name: '失败次数', requirementIds: ['R1'], levels: ['5'], sourceQuote: spec }],
      scenarios: [
        {
          id: 'S1',
          title: '第五次失败',
          requirementIds: ['R1'],
          dimension: 'boundary',
          expected: '锁定',
          factorLevels: [{ factorId: 'F1', level: '5' }],
        },
      ],
      gaps: [],
    };
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (command: string, args: { request?: { prompt: string } }) => {
          if (command === 'cancel_cli_turn') return;
          if (command !== 'send_cli_turn') throw new Error('offline_fixture');
          const task = JSON.parse(args.request!.prompt);
          let output: unknown = requirements;
          if (task.operation === 'scenarios.design') {
            const count = Number(sessionStorage.getItem('quote.calls') || 0) + 1;
            sessionStorage.setItem('quote.calls', String(count));
            sessionStorage.setItem('quote.feedback', JSON.stringify(task.sourceQuoteFeedback ?? null));
            output =
              count === 1
                ? { ...design, factors: [{ ...design.factors[0], sourceQuote: `Outside context. ${spec}` }] }
                : design;
          }
          return {
            status: 'completed',
            text: JSON.stringify(output),
            errorCode: null,
            nativeSessionId: null,
          };
        },
      },
    });
  }, definition);
  await page.goto('/');
  const composer = page.locator('.session-composer');
  await composer.getByLabel('已保存流程').selectOption('workflow');
  await composer.locator('textarea').fill('账户连续失败5次后锁定。');
  await composer.getByRole('button', { name: '调用流程', exact: true }).click();
  const panel = page.getByRole('complementary', { name: '流程进度' });
  await panel.getByRole('button', { name: '打开评审工作区', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认并继续', exact: true }).click();
  await expect(panel).toContainText('测试因子的引用不在所关联需求的原文范围内');
  await expect(page.locator('.session-cli-turn').last()).toContainText('F1');
  await page.reload();
  expect(await page.evaluate(() => sessionStorage.getItem('quote.calls'))).toBe('1');
  await panel.getByRole('button', { name: '重试当前节点', exact: true }).click();
  await expect(panel.getByRole('button', { name: '打开评审工作区', exact: true })).toBeVisible();
  const feedback = await page.evaluate(() => JSON.parse(sessionStorage.getItem('quote.feedback')!));
  expect(feedback.code).toBe('design_factor_quote_invalid');
  expect(feedback.issues).toEqual([{ factorId: 'F1', requirementIds: ['R1'] }]);
  expect(feedback.instruction).toContain('never add unrelated requirement IDs');
});
