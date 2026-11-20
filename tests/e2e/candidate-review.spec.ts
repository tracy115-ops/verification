import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { reportRunFixture } from '../fixtures/report-run';
import { zh, en } from '../../src/shared/i18n/messages';

test('retains a review draft, saves an audit trail and reopens it from run records', async ({ page }) => {
  const run = reportRunFixture();
  const report = Object.values(run.artifacts).find((item) => item.type === 'VerificationReport')!;
  await page.addInitScript((run) => {
    if (!localStorage.getItem('verification-workbench.conversations.v1'))
      localStorage.setItem(
        'verification-workbench.conversations.v1',
        JSON.stringify([
          {
            id: run.sessionId,
            title: '候选问题人工复核',
            profileId: run.defaultProfileId,
            messages: [],
            runs: [run],
          },
        ]),
      );
    localStorage.setItem('verification-workbench.active-conversation', run.sessionId);
  }, run);
  await page.goto('/');
  const open = page
    .getByRole('complementary', { name: '流程进度' })
    .getByRole('button', { name: '查看本次报告' });
  await open.click();
  const dialog = page.getByRole('dialog', { name: '验证报告' });
  const review = dialog.getByRole('region', { name: '人工复核' });
  await review.getByText('记录复核结论', { exact: true }).click();
  await expect(review.getByRole('button', { name: '保存复核' })).toBeDisabled();
  await review.getByRole('combobox', { name: '复核结论', exact: true }).selectOption('confirmed');
  await review
    .getByLabel('理由与证据说明')
    .fill('题目要求容量 1 返回 400，实际响应 201，已核对请求身份和输入。');
  await page.keyboard.press('Escape');
  await open.click();
  await review.getByText('记录复核结论', { exact: true }).click();
  await expect(review.getByLabel('理由与证据说明')).toHaveValue(/实际响应 201/);
  await review.getByRole('button', { name: '保存复核' }).click();
  await expect(review.locator('.candidate-review-state')).toContainText('确认缺陷');
  await review.getByText('复核历史', { exact: false }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    review.getByRole('button', { name: '导出复核记录' }).click(),
  ]);
  const exported = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(exported.kind).toBe('candidate-review');
  expect(exported.reportDigest).toBe(report.digest);
  expect(exported.events).toHaveLength(1);
  expect(exported.events[0]).toMatchObject({ status: 'confirmed', runId: run.id });
  await page.reload();
  await page.getByRole('button', { name: '运行实例', exact: true }).click();
  await page.getByRole('button', { name: '查看本次报告', exact: true }).click();
  await expect(review.locator('.candidate-review-state')).toContainText('确认缺陷');
  await review.getByText('更新复核结论', { exact: true }).click();
  await review.getByRole('combobox', { name: '复核结论', exact: true }).selectOption('needs_evidence');
  await review.getByLabel('理由与证据说明').fill('需要在另一份独立初始状态上复跑，核对稳定性。');
  await review.getByRole('button', { name: '保存复核' }).click();
  await expect(review.locator('.candidate-review-state')).toContainText('待补证据');
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs[0],
  );
  expect(stored.artifacts['candidate.reviews'].value.events).toHaveLength(2);
  expect(Object.values(stored.artifacts).find((item: any) => item.type === 'VerificationReport')).toEqual(
    report,
  );
});

test('records missing evidence while disabling confirmation and false-positive decisions', async ({
  page,
}) => {
  const run = reportRunFixture();
  for (const [key, artifact] of Object.entries(run.artifacts))
    if (artifact.type === 'EvidenceBundle') delete run.artifacts[key];
  await page.addInitScript((run) => {
    localStorage.setItem(
      'verification-workbench.conversations.v1',
      JSON.stringify([
        {
          id: run.sessionId,
          title: 'Evidence recovery',
          profileId: run.defaultProfileId,
          messages: [],
          runs: [run],
        },
      ]),
    );
    localStorage.setItem('verification-workbench.active-conversation', run.sessionId);
  }, run);
  await page.goto('/');
  await page
    .getByRole('complementary', { name: '流程进度' })
    .getByRole('button', { name: '查看本次报告' })
    .click();
  const review = page.getByRole('region', { name: '人工复核' });
  await review.getByText('记录复核结论', { exact: true }).click();
  const decision = review.getByRole('combobox', { name: '复核结论', exact: true });
  await expect(decision.locator('option[value="confirmed"]')).toHaveAttribute('disabled', '');
  await expect(decision.locator('option[value="false_positive"]')).toHaveAttribute('disabled', '');
  await review.getByLabel('理由与证据说明').fill('需要找回本次执行的原始请求响应。');
  await review.getByRole('button', { name: '保存复核' }).click();
  await expect(review.locator('.candidate-review-state')).toContainText('待补证据');
});

test('checks review controls in both languages, themes and window widths', async ({ page }) => {
  test.setTimeout(90000);
  const run = reportRunFixture();
  for (const locale of ['zh-CN', 'en-US'] as const)
    for (const dark of [false, true])
      for (const width of [900, 1500]) {
        const t = locale === 'zh-CN' ? zh : en;
        await page.goto('/');
        await page.evaluate(
          ({ run, locale, dark }) => {
            localStorage.setItem('verification-workbench.appearance.v1', JSON.stringify({ locale, dark }));
            localStorage.setItem(
              'verification-workbench.conversations.v1',
              JSON.stringify([
                {
                  id: run.sessionId,
                  title: 'Candidate review',
                  profileId: run.defaultProfileId,
                  messages: [],
                  runs: [run],
                },
              ]),
            );
            localStorage.setItem('verification-workbench.active-conversation', run.sessionId);
          },
          { run, locale, dark },
        );
        await page.setViewportSize({ width, height: 960 });
        await page.reload();
        await page
          .getByRole('complementary', { name: t.workflowProgress })
          .getByRole('button', { name: t.openReport })
          .click();
        const dialog = page.getByRole('dialog', { name: t.verificationReport });
        const review = dialog.getByRole('region', { name: t.candidateReviewTitle });
        await review.getByText(t.candidateReviewRecord, { exact: true }).click();
        await expect(review.getByLabel(t.candidateReviewDecision)).toHaveValue('needs_evidence');
        await expect(review.getByLabel(t.candidateReviewReason)).toBeVisible();
        expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        await dialog.screenshot({
          path: `.runtime/candidate-review-${locale}-${dark ? 'dark' : 'light'}-${width}.png`,
        });
        await page.keyboard.press('Escape');
      }
});
