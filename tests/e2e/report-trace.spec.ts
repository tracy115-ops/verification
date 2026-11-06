import { expect, test } from '@playwright/test';
import { reportRunFixture } from '../fixtures/report-run';

test('reviews a real recorded candidate through HTTP evidence, cases and source, including missing evidence', async ({
  page,
}) => {
  const run = reportRunFixture();
  await page.addInitScript((run) => {
    if (!localStorage.getItem('verification-workbench.conversations.v1')) {
      localStorage.setItem(
        'verification-workbench.conversations.v1',
        JSON.stringify([
          {
            id: run.sessionId,
            title: '报告证据链复核',
            profileId: run.defaultProfileId,
            messages: [],
            runs: [run],
          },
        ]),
      );
      localStorage.setItem('verification-workbench.active-conversation', run.sessionId);
    }
  }, run);
  await page.goto('/');
  const panel = page.getByRole('complementary', { name: '流程进度' });
  await panel.getByRole('button', { name: '查看本次报告', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '验证报告' });
  const trace = dialog.getByRole('region', { name: '候选问题证据链' });
  await expect(trace.getByRole('combobox', { name: '关联测试方法' })).toHaveValue(
    'test_cap_1_invalid_returns_400',
  );
  await expect(trace).toContainText('AssertionError: 400 != 201');
  await expect(trace.locator('.session-request-evidence')).toHaveCount(2);
  await expect(trace.locator('.session-request-evidence').last()).toContainText('POST /rooms');
  await trace
    .locator('.session-request-evidence')
    .last()
    .getByText('请求与响应详情', { exact: true })
    .click();
  await expect(trace.locator('.session-request-evidence').last()).toContainText('"maxPlayers": 1');
  await trace.getByRole('button', { name: '用例与原文', exact: true }).click();
  await expect(trace).toContainText('B1-TC-CAP-1-INVALID-400');
  await expect(trace.locator('blockquote')).toContainText([
    'submits POST /rooms with JSON',
    'maxPlayers=1 returns HTTP 400',
  ]);
  await expect(trace).not.toContainText('REQ-CAP-8');
  await trace.getByRole('button', { name: '执行时脚本', exact: true }).click();
  await expect(trace).toContainText('self.assertEqual(400, response.status)');
  await trace.getByRole('button', { name: 'Agent 分析', exact: true }).click();
  await expect(trace).toContainText('待复核的判断');
  await trace.getByRole('button', { name: '执行证据', exact: true }).click();
  for (const width of [900, 1500]) {
    await page.setViewportSize({ width, height: 960 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await dialog.screenshot({ path: `.runtime/report-trace-${width}-${theme}.png` });
    }
  }
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const key = 'verification-workbench.conversations.v1';
    const sessions = JSON.parse(localStorage.getItem(key)!);
    const artifacts = sessions[0].runs[0].artifacts;
    for (const name of Object.keys(artifacts))
      if (artifacts[name].type === 'EvidenceBundle') delete artifacts[name];
    localStorage.setItem(key, JSON.stringify(sessions));
  });
  await page.reload();
  await panel.getByRole('button', { name: '查看本次报告', exact: true }).click();
  await expect(dialog).toContainText('不会用其他运行的结果替代');
  await expect(dialog.locator('.session-request-evidence')).toHaveCount(0);
});
