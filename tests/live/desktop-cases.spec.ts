import { chromium, expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { WorkflowRun } from '../../src/domain/runtime/types';

test('edits cases in the Release desktop with original IPC and retains review boundaries', async () => {
  const endpoint = process.env.DESKTOP_AUDIT_ENDPOINT;
  test.skip(!endpoint, 'Explicit isolated native desktop audit required.');
  const browser = await chromium.connectOverCDP(endpoint!);
  const page = browser.contexts()[0].pages()[0];
  const output = path.resolve('.runtime/native-case-edit');
  mkdirSync(output, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    expect(page.url()).toContain('tauri.localhost');
    const fixture = JSON.parse(
      readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
    ) as WorkflowRun;
    await page.evaluate((run) => {
      localStorage.setItem(
        'verification-workbench.appearance.v1',
        JSON.stringify({ locale: 'zh-CN', dark: false }),
      );
      localStorage.setItem(
        'verification-workbench.conversations.v1',
        JSON.stringify([
          {
            id: run.sessionId,
            title: '原生桌面用例修订验收',
            profileId: 'codeagent-native',
            messages: [],
            runs: [run],
          },
        ]),
      );
    }, fixture);
    await page.reload();
    await page.getByRole('button', { name: '验证资产', exact: true }).click();
    await page.getByRole('button', { name: '测试用例', exact: true }).click();
    await page.getByRole('button', { name: '编辑用例', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '补充测试用例' });
    await editor.getByLabel('用例名称', { exact: true }).fill('原生桌面状态码断言复核');
    await editor.getByRole('button', { name: '保留草稿并关闭' }).click();
    await page.getByRole('button', { name: '编辑用例', exact: true }).click();
    await expect(editor.getByLabel('用例名称', { exact: true })).toHaveValue('原生桌面状态码断言复核');
    await editor.getByRole('button', { name: '2 · 步骤与断言' }).click();
    await editor.getByLabel('具体断言（每行一项）', { exact: true }).fill('response.status == 201');
    await page.screenshot({ path: path.join(output, 'case-assertions-native.png') });
    await editor.getByRole('button', { name: '3 · 变更说明' }).click();
    await editor.getByLabel('本次修改原因', { exact: true }).fill('本地 Release 原生交互验证');
    await editor.getByRole('button', { name: '保存并评审用例', exact: true }).click();
    await expect(editor).not.toBeVisible();
    await expect(page.locator('.assets-detail')).toContainText('原生桌面状态码断言复核');
    const revised: WorkflowRun = await page.evaluate(
      () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs[0],
    );
    expect(revised.status).toBe('awaiting_review');
    expect(revised.approvals).toHaveLength(2);
    expect(revised.artifacts['history.cases.1']).toBeDefined();
    expect(Object.values(revised.artifacts).some((item) => item.type === 'TestCaseSet')).toBe(false);
    await page.screenshot({ path: path.join(output, 'case-saved-native.png') });
    await page.locator('.app-settings button').click();
    await page.getByRole('button', { name: '在线升级', exact: true }).click();
    const version = await page.locator('.settings-version-row strong').textContent();
    if (process.env.DESKTOP_AUDIT_VERSION) expect(version).toBe(process.env.DESKTOP_AUDIT_VERSION);
    expect(errors).toEqual([]);
    writeFileSync(
      path.join(output, 'summary.json'),
      JSON.stringify(
        {
          version,
          originalIpc: true,
          historicalFixture: true,
          freshModelCall: false,
          draftRetained: true,
          caseRevisionSaved: true,
          caseReviewReopened: true,
          unhandledErrors: errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
});
