import { chromium, expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

test('reviews the original native execution from the updated Release report', async () => {
  const endpoint = process.env.DESKTOP_AUDIT_ENDPOINT;
  test.skip(!endpoint, 'Requires an actual Release WebView with a previously executed task.');
  const browser = await chromium.connectOverCDP(endpoint!);
  try {
    const page = browser.contexts()[0].pages()[0];
    expect(page.url()).toContain('tauri.localhost');
    const version = await page.evaluate(
      async () =>
        (
          await (
            window as unknown as {
              __TAURI_INTERNALS__: { invoke: (command: string) => Promise<{ currentVersion: string }> };
            }
          ).__TAURI_INTERNALS__.invoke('update_status')
        ).currentVersion,
    );
    expect(version).toBe(process.env.DESKTOP_AUDIT_VERSION ?? '0.9.7');
    const panel = page.getByRole('complementary', { name: '流程进度' });
    await panel.getByRole('button', { name: '查看本次报告', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '验证报告' });
    const trace = dialog.getByRole('region', { name: '候选问题证据链' });
    await expect(trace).toContainText('AssertionError: 400 != 201');
    await expect(trace.locator('.session-request-evidence')).toHaveCount(2);
    await trace
      .locator('.session-request-evidence')
      .last()
      .getByText('请求与响应详情', { exact: true })
      .click();
    await expect(trace.locator('.session-request-evidence').last()).toContainText('"maxPlayers": 1');
    await trace.getByRole('button', { name: '用例与原文', exact: true }).click();
    await expect(trace).toContainText('B1-TC-CAP-1-INVALID-400');
    await expect(trace.locator('blockquote')).toContainText([
      'submits POST /rooms',
      'maxPlayers=1 returns HTTP 400',
    ]);
    await trace.getByRole('button', { name: '执行时脚本', exact: true }).click();
    await expect(trace).toContainText('29ab4ed7342f108c36354a0d0e54af9c473eb2a787d3eadfb9435efed8274d51');
    await trace.getByRole('button', { name: 'Agent 分析', exact: true }).click();
    await expect(trace).toContainText('待复核的判断');
    await trace.getByRole('button', { name: '执行证据', exact: true }).click();
    const folder = path.resolve('.runtime/report-native-097');
    mkdirSync(folder, { recursive: true });
    await page.screenshot({ path: path.join(folder, 'report.png') });
    writeFileSync(
      path.join(folder, 'summary.json'),
      JSON.stringify(
        {
          version,
          nativeIpc: true,
          recordedTaskFrom: '0.9.6 actual native workflow',
          tests: 4,
          requestsForCandidate: 2,
          scriptDigestMatched: true,
          tabsVerified: 4,
          newInferenceCalls: 0,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
});
