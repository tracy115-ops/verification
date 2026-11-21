import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { reportRunFixture } from '../fixtures/report-run';

test('exports an executed candidate with the full approved suite and refuses missing evidence', async ({
  page,
}) => {
  const run = reportRunFixture();
  await page.addInitScript((run) => {
    if (!localStorage.getItem('verification-workbench.conversations.v1'))
      localStorage.setItem(
        'verification-workbench.conversations.v1',
        JSON.stringify([
          {
            id: run.sessionId,
            title: '复现资料导出',
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
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: '导出复现资料', exact: true }).click(),
  ]);
  const bundle = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(bundle).toMatchObject({
    kind: 'candidate-reproduction',
    formatVersion: 1,
    scope: 'approved-suite',
    runId: run.id,
  });
  expect(bundle.implementation.tests).toHaveLength(4);
  expect(bundle.framework.frameworkSource).toContain('class BlackBoxCase');
  expect(bundle.execution.evidence.results).toHaveLength(4);
  expect(bundle.source.requirements.requirements.length).toBeGreaterThan(0);
  expect(bundle).not.toHaveProperty('profiles');
  await dialog.screenshot({ path: '.runtime/candidate-reproduction.png' });
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const key = 'verification-workbench.conversations.v1';
    const sessions = JSON.parse(localStorage.getItem(key)!);
    const artifacts = sessions[0].runs[0].artifacts;
    for (const [name, artifact] of Object.entries(artifacts))
      if ((artifact as { type: string }).type === 'EvidenceBundle') delete artifacts[name];
    localStorage.setItem(key, JSON.stringify(sessions));
  });
  await page.reload();
  await open.click();
  await expect(dialog.getByRole('button', { name: '导出复现资料', exact: true })).toBeDisabled();
  await expect(dialog.locator('.candidate-reproduction')).toContainText('复现资料不完整');
});
