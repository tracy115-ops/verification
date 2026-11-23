import { expect, test } from '@playwright/test';
import { reportRunFixture } from '../fixtures/report-run';
import { createHash } from 'node:crypto';
import { journeyFixture } from '../fixtures/scenario-journey';
import { zh, en } from '../../src/shared/i18n/messages';

test('edits a state path, rejects disconnected state, preserves source links and reopens approval', async ({
  page,
}) => {
  test.setTimeout(90000);
  const fixture = journeyFixture();
  const run = reportRunFixture();
  run.spec = fixture.spec;
  run.artifacts = {};
  run.approvals = [];
  for (const node of run.plan) run.steps[node.id] = { status: 'pending', attempts: 0 };
  const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const requirements = run.plan.find((item) => item.operation === 'requirements.extract')!;
  const baseline = run.plan.find((item) => item.operation === 'review.requirements')!;
  const producer = run.plan.find((item) => item.operation === 'scenarios.design')!;
  const review = run.plan.find((item) => item.operation === 'review.coverage')!;
  for (const node of [requirements, baseline, producer])
    run.steps[node.id] = { status: 'succeeded', attempts: 1 };
  run.status = 'awaiting_review';
  run.steps[review.id] = { status: 'awaiting_review', attempts: 0 };
  run.artifacts[`${baseline.id}.${Object.keys(baseline.outputs)[0]}`] = {
    type: 'RequirementBaseline',
    value: fixture.requirements,
    digest: await digest(fixture.requirements),
  };
  run.artifacts[`${producer.id}.${Object.keys(producer.outputs)[0]}`] = {
    type: 'TestDesignDraft',
    value: fixture.design,
    digest: await digest(fixture.design),
  };
  await page.goto('/');
  await page.evaluate((run) => {
    localStorage.setItem(
      'verification-workbench.conversations.v1',
      JSON.stringify([
        {
          id: run.sessionId,
          title: 'Journey editing contract',
          profileId: run.defaultProfileId,
          messages: [],
          runs: [run],
        },
      ]),
    );
    localStorage.setItem('verification-workbench.active-conversation', run.sessionId);
  }, run);
  await page.reload();
  await page.getByRole('button', { name: '验证资产', exact: true }).click();
  await page.getByRole('button', { name: '场景设计与映射', exact: true }).click();
  await expect(page.getByRole('region', { name: '场景旅程' })).toContainText('reserved → paid');
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByRole('button', { name: 'T2', exact: true }).click();
  await editor.getByLabel('执行前状态', { exact: true }).fill('wrong state');
  await editor.getByLabel('修改说明', { exact: true }).fill('Review rejection observation');
  await editor.getByRole('button', { name: '保存并重新评审', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('旅程状态不连续');
  await editor.getByLabel('执行前状态', { exact: true }).fill('reserved');
  await editor.getByRole('button', { name: '追加步骤', exact: true }).click();
  await editor.getByRole('button', { name: '删除当前步骤', exact: true }).click();
  await editor.getByRole('button', { name: 'T2', exact: true }).click();
  await editor
    .getByLabel('旅程前置条件（每行一项，可选）')
    .fill('Fresh independent initial state\nRetain runtime order ID');
  await editor
    .getByRole('textbox', { name: '可观测结果', exact: true })
    .fill('402; read back the order and verify it remains reserved');
  await editor.getByRole('button', { name: '保存并重新评审', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('region', { name: '场景旅程' })).toContainText('read back the order');
  await page.reload();
  await page.getByRole('button', { name: '验证资产', exact: true }).click();
  await page.getByRole('button', { name: '场景设计与映射', exact: true }).click();
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs[0],
  );
  expect(stored.status).toBe('awaiting_review');
  expect(stored.artifacts['history.design.1'].value.artifacts).toEqual(run.artifacts);
  const value = Object.values(stored.artifacts).find((item: any) => item.type === 'TestDesignDraft') as any;
  expect(value.value.scenarios[0].journey.preconditions).toHaveLength(2);
  expect(value.value.scenarios[0].journey.steps[1].sourceQuote).toBe(
    fixture.requirements.requirements[1].quote,
  );
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
        await page.getByRole('button', { name: t.assetsTitle, exact: true }).click();
        await page.getByRole('button', { name: t.scenarioItems, exact: true }).click();
        const view = page.getByRole('region', { name: t.journeyTitle });
        await expect(view).toContainText('reserved → paid');
        expect(await view.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        await view.screenshot({ path: `.runtime/journey-${locale}-${dark ? 'dark' : 'light'}-${width}.png` });
        await page.getByRole('button', { name: t.designEdit, exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('button', { name: 'T2', exact: true }).click();
        await expect(dialog.getByRole('textbox', { name: t.journeyObservation, exact: true })).toBeVisible();
        const fields = dialog.locator('.journey-editor');
        expect(await fields.evaluate((node) => getComputedStyle(node).maxHeight)).toBe('none');
        expect(await fields.evaluate((node) => getComputedStyle(node).overflowY)).toBe('visible');
        await dialog
          .getByRole('textbox', { name: t.journeyObservation, exact: true })
          .scrollIntoViewIfNeeded();
        expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        await dialog.screenshot({
          path: `.runtime/journey-editor-${locale}-${dark ? 'dark' : 'light'}-${width}.png`,
        });
        await page.keyboard.press('Escape');
      }
});
