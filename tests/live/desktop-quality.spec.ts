import { chromium, expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { DesignArtifact, WorkflowRun } from '../../src/domain/runtime/types';
import { zh, en } from '../../src/shared/i18n/messages';

test('checks gap handoff and manual repair through the original desktop UI and IPC', async () => {
  const endpoint = process.env.DESKTOP_AUDIT_ENDPOINT;
  test.skip(!endpoint, 'Explicit isolated native desktop audit required.');
  const browser = await chromium.connectOverCDP(endpoint!);
  const page = browser.contexts()[0].pages()[0];
  const output = path.resolve('.runtime/native-design-quality');
  mkdirSync(output, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    expect(page.url()).toContain('tauri.localhost');
    // Historical structure with one controlled missing link. No model output is simulated.
    const run = JSON.parse(
      readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
    ) as WorkflowRun;
    run.plan.reverse();
    const design = Object.values(run.artifacts).find((item) => item.type === 'TestDesign')!
      .value as DesignArtifact;
    design.scenarios[0].factorLevels = [];
    await page.evaluate((run) => {
      localStorage.setItem(
        'verification-workbench.conversations.v1',
        JSON.stringify([
          {
            id: run.sessionId,
            title: '原生桌面缺口修复验收',
            profileId: 'codeagent-native',
            messages: [],
            runs: [run],
            draft: {
              text: '保留原生窗口备注',
              invoke: false,
              profileId: 'codeagent-native',
              frameworkId: '',
              useNodeBindings: false,
              contextMode: 'recent',
            },
          },
        ]),
      );
    }, run);
    await page.reload();
    await page.getByRole('button', { name: '验证资产', exact: true }).click();
    await page.getByRole('button', { name: '覆盖矩阵', exact: true }).click();
    await expect(page.locator('.design-quality')).toContainText('有场景的因子水平 · 3 / 4');
    await page.screenshot({ path: path.join(output, 'gap-native-light-zh.png') });
    await page.locator('.design-quality').getByRole('button', { name: '围绕这些缺口补充设计' }).click();
    await expect(page.locator('.session-composer textarea')).toHaveValue(/保留原生窗口备注[\s\S]*F1/);
    await expect(page.getByRole('button', { name: '生成修改提议', exact: true })).toBeEnabled();
    // Do not submit: this audit verifies the UI path without a paid or unverified CLI call.
    await page.getByRole('button', { name: '验证资产', exact: true }).click();
    await page.getByRole('button', { name: '场景设计与映射', exact: true }).click();
    await page.getByLabel('搜索 ID、标题或关联内容').fill('S1');
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '补充测试设计' });
    await editor.getByLabel('F1 · maxPlayers 容量', { exact: true }).selectOption('2');
    await editor.getByLabel('修改说明', { exact: true }).fill('补齐遗漏的已有因子水平映射');
    await editor.getByRole('button', { name: '保存并重新评审', exact: true }).click();
    await expect(editor).not.toBeVisible();
    await page.getByRole('button', { name: '覆盖矩阵', exact: true }).click();
    await expect(page.locator('.design-quality')).toContainText('有场景的因子水平 · 4 / 4');
    await expect(page.locator('.design-quality')).toContainText('待生成 · 4');
    const revised: WorkflowRun = await page.evaluate(
      () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs[0],
    );
    expect(revised.approvals).toHaveLength(1);
    expect(Object.values(revised.artifacts).some((item) => item.type === 'TestCaseSet')).toBe(false);
    expect(revised.artifacts['history.design.1']).toBeDefined();
    await page.screenshot({ path: path.join(output, 'repaired-native-light-zh.png') });
    await page.locator('.app-settings button').click();
    await page.getByRole('button', { name: zh.systemUpdates, exact: true }).click();
    const version = (await page.locator('.settings-version-row strong').textContent())!;
    if (process.env.DESKTOP_AUDIT_VERSION) expect(version).toBe(process.env.DESKTOP_AUDIT_VERSION);
    await page.getByRole('button', { name: zh.generalSettings, exact: true }).click();
    await page.getByLabel(zh.language).selectOption('en-US');
    await page.getByRole('button', { name: en.dark, exact: true }).click();
    await page.getByRole('button', { name: en.assetsTitle, exact: true }).click();
    await page.getByRole('button', { name: en.matrixTitle, exact: true }).click();
    await expect(page.locator('.design-quality')).toContainText(en.qualityPendingCases);
    await page.screenshot({ path: path.join(output, 'repaired-native-dark-en.png') });
    expect(errors).toEqual([]);
    writeFileSync(
      path.join(output, 'summary.json'),
      JSON.stringify(
        {
          version,
          originalIpc: true,
          historicalFixture: true,
          injectedMissingLink: true,
          freshModelCall: false,
          originalDraftRetained: true,
          manuallyRepaired: true,
          reorderedDescendantsInvalidated: true,
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
