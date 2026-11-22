import { expect, test } from '@playwright/test';
import { reportRunFixture } from '../fixtures/report-run';
import { en, zh } from '../../src/shared/i18n/messages';

test('preflights, requires confirmation, compares replays and preserves the original report', async ({
  page,
}) => {
  test.setTimeout(90000);
  const source = reportRunFixture();
  const originalPlan = Object.values(source.artifacts).find((item) => item.type === 'ExecutionPlan')!.value;
  const originalEvidence = Object.values(source.artifacts).find(
    (item) => item.type === 'EvidenceBundle',
  )!.value;
  await page.addInitScript(
    ({ source, originalPlan, originalEvidence }) => {
      let rejectExecution: ((reason: string) => void) | undefined;
      if (!localStorage.getItem('verification-workbench.conversations.v1'))
        localStorage.setItem(
          'verification-workbench.conversations.v1',
          JSON.stringify([
            {
              id: source.sessionId,
              title: '应用内复跑验收',
              profileId: source.defaultProfileId,
              messages: [],
              runs: [source],
            },
          ]),
        );
      localStorage.setItem('verification-workbench.active-conversation', source.sessionId);
      Object.assign(globalThis, {
        isTauri: true,
        __TAURI_INTERNALS__: {
          transformCallback: () => 1,
          unregisterCallback: () => {},
          invoke: async (command: string, args: any) => {
            if (command === 'send_cli_turn') throw new Error('unexpected_model_call');
            if (command === 'preflight_python') {
              const count = Number(sessionStorage.getItem('preflights') ?? '0') + 1;
              sessionStorage.setItem('preflights', String(count));
              return {
                ...(originalPlan as object),
                payload: args.payload,
                digest: count.toString(16).padStart(64, '0'),
              };
            }
            if (command === 'execute_python') {
              const count = Number(sessionStorage.getItem('executions') ?? '0') + 1;
              sessionStorage.setItem('executions', String(count));
              if (count === 3)
                return new Promise((_, reject) => {
                  rejectExecution = reject;
                });
              return {
                ...(originalEvidence as any),
                executionId: args.payload.executionId,
                planDigest: args.approvedDigest,
                results: (originalEvidence as any).results.map((item: any) => ({
                  ...item,
                  status: count >= 2 ? 'passed' : item.status,
                })),
              };
            }
            if (command === 'cancel_python') {
              rejectExecution?.('execution_cancelled');
              rejectExecution = undefined;
              return;
            }
            return Promise.reject('offline_fixture');
          },
        },
      });
    },
    { source, originalPlan, originalEvidence },
  );
  await page.goto('/');
  const panel = page.getByRole('complementary', { name: '流程进度' });
  await panel.getByRole('button', { name: '查看本次报告' }).click();
  await page
    .getByRole('dialog', { name: '验证报告' })
    .getByRole('button', { name: '预检并准备复跑' })
    .click();
  const summary = panel.getByRole('region', { name: '复跑观察' });
  await expect(summary).toContainText('尚无复跑结果');
  expect(await page.evaluate(() => sessionStorage.getItem('executions'))).toBeNull();
  await panel.getByRole('button', { name: '打开评审工作区', exact: true }).click();
  const review = page.getByRole('dialog');
  await expect(review.getByRole('button', { name: '确认并继续' })).toBeDisabled();
  await review.getByRole('checkbox').check();
  await review.getByRole('button', { name: '确认并继续' }).click();
  await expect(summary).toContainText('观察到一次失败');
  await summary.getByRole('button', { name: '再次准备复跑' }).click();
  await panel.getByRole('button', { name: '打开评审工作区', exact: true }).click();
  await review.getByRole('checkbox').check();
  await review.getByRole('button', { name: '确认并继续' }).click();
  await expect(summary).toContainText('复跑结果不一致');
  await summary.getByRole('button', { name: '再次准备复跑' }).click();
  await panel.getByRole('button', { name: '打开评审工作区', exact: true }).click();
  await review.getByRole('checkbox').check();
  await review.getByRole('button', { name: '确认并继续' }).click();
  await panel.getByRole('button', { name: '停止执行', exact: true }).click();
  const lastRun = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs.at(-1),
    );
  await expect.poll(async () => (await lastRun()).status).toBe('cancelled');
  const cancelled = await lastRun();
  const oldId = Object.values(cancelled.artifacts).find((item: any) => item.type === 'ExecutionPlan') as any;
  await panel.getByRole('button', { name: '重新预检并确认执行', exact: true }).click();
  await panel.getByRole('button', { name: '打开评审工作区', exact: true }).click();
  const newPlan = Object.values((await lastRun()).artifacts).find(
    (item: any) => item.type === 'ExecutionPlan',
  ) as any;
  expect(newPlan.value.payload.executionId).not.toBe(oldId.value.payload.executionId);
  await review.getByRole('checkbox').check();
  await review.getByRole('button', { name: '确认并继续' }).click();
  await expect.poll(async () => (await lastRun()).status).toBe('completed');
  await page.screenshot({ path: '.runtime/reproduction-run-summary.png' });
  await page.reload();
  await page.getByRole('button', { name: '运行实例', exact: true }).click();
  await expect(page.getByRole('region', { name: '复跑观察' })).toContainText('复跑结果不一致');
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs,
  );
  expect(stored).toHaveLength(4);
  expect(stored[0]).toEqual(source);
  expect(stored[1].id).not.toBe(stored[2].id);
  for (const locale of ['zh-CN', 'en-US'] as const)
    for (const dark of [false, true])
      for (const width of [900, 1500]) {
        const t = locale === 'zh-CN' ? zh : en;
        await page.evaluate(
          ({ locale, dark }) =>
            localStorage.setItem('verification-workbench.appearance.v1', JSON.stringify({ locale, dark })),
          { locale, dark },
        );
        await page.setViewportSize({ width, height: 960 });
        await page.reload();
        await page.getByRole('button', { name: t.runs, exact: true }).click();
        const observation = page.getByRole('region', { name: t.reproductionTitle });
        await expect(observation).toContainText(t.reproduction_intermittent);
        expect(await observation.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        await observation.screenshot({
          path: `.runtime/reproduction-${locale}-${dark ? 'dark' : 'light'}-${width}.png`,
        });
      }
});
