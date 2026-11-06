import { chromium, expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { WorkflowRun } from '../../src/domain/runtime/types';
import type { EvidenceBundle, VerificationReport } from '../../src/domain/execution/types';

test('operates the Release desktop from configuration through real execution and report', async () => {
  const endpoint = process.env.DESKTOP_AUDIT_ENDPOINT;
  const targetUrl = process.env.DESKTOP_AUDIT_TARGET;
  const settingsFile = process.env.CLI_AUDIT_SETTINGS_FILE;
  const executable = process.env.CLI_AUDIT_EXECUTABLE;
  const model = process.env.CLI_AUDIT_MODEL;
  test.skip(
    !endpoint || !targetUrl || !settingsFile || !executable || !model,
    'Explicit native desktop audit environment required.',
  );
  const output = path.resolve('.runtime/desktop-e2e/evidence');
  mkdirSync(output, { recursive: true });
  const browser = await chromium.connectOverCDP(endpoint!);
  const page = browser.contexts()[0].pages()[0];
  const events: { stage: string; at: string }[] = [];
  const record = (stage: string) => {
    events.push({ stage, at: new Date().toISOString() });
    console.log(stage);
    writeFileSync(path.join(output, 'stages.json'), JSON.stringify(events, null, 2));
  };
  const source =
    'Black-box room capacity verification. The trusted framework submits POST /rooms with JSON {maxPlayers,mode,ranked}. Shared fixed preconditions for all four tests: identity player-a, mode=duel, ranked=false, and an independent fresh framework fixture per test. Exactly four test scenarios and four independent test cases are in scope: maxPlayers=2 returns HTTP 201; maxPlayers=8 returns HTTP 201; maxPlayers=1 returns HTTP 400; maxPlayers=9 returns HTTP 400. Only assert these HTTP status results. Other inputs, authentication variations, missing fields, response fields, concurrency and dependency faults are explicitly out of scope. Do not create extra tests for fixed preconditions. The supplied framework returns a Response with .status and .body and resets the fixture in setUp.';
  async function readRun(): Promise<WorkflowRun | undefined> {
    return page.evaluate(() => {
      const sessions = JSON.parse(localStorage.getItem('verification-workbench.conversations.v1') || '[]');
      const active = localStorage.getItem('verification-workbench.active-conversation');
      return sessions.find((item: { id: string }) => item.id === active)?.runs.at(-1);
    });
  }
  try {
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
    expect(version).toBe(process.env.DESKTOP_AUDIT_VERSION ?? '0.9.6');
    if (process.env.DESKTOP_AUDIT_RESUME && (await page.getByRole('dialog').isVisible()))
      await page.keyboard.press('Escape');
    if (!process.env.DESKTOP_AUDIT_RESUME) {
      await page.getByRole('button', { name: '设置', exact: true }).click();
      await page.getByRole('button', { name: 'Agent 与 Provider', exact: true }).click();
      await page.getByLabel('要配置的 Agent').selectOption('claude-native');
      await page.getByRole('button', { name: '查找已有设置文件' }).click();
      await page
        .locator('.settings-config-source')
        .filter({ hasText: settingsFile! })
        .getByRole('button', { name: '使用此设置文件' })
        .click();
      const instance = page.locator('.settings-native-instance');
      await instance.locator('summary').first().click();
      await instance.getByText('高级：手动编辑路径', { exact: true }).click();
      await instance.getByLabel('CLI 启动文件的绝对路径').fill(executable!);
      await instance.getByRole('button', { name: '保存实例绑定' }).click();
      const modelForm = page.locator('.settings-model-row');
      await modelForm.getByRole('textbox').fill(model!);
      await modelForm.getByRole('button', { name: '保存模型' }).click();
      const check = page.getByRole('region', { name: '连通检查 · claude / native', exact: true });
      await check.getByRole('button', { name: '发送短测试' }).click();
      await expect(check.getByRole('status')).toContainText('短对话已验证', { timeout: 75_000 });
      record('native_configuration_passed');
      await page.getByRole('button', { name: '测试框架与执行', exact: true }).click();
      const framework = page.locator('.settings-framework-form');
      await framework
        .getByRole('textbox', { name: '框架名称', exact: true })
        .fill('Desktop E2E room capacity');
      await framework.getByRole('textbox', { name: '被测接口基础地址', exact: true }).fill(targetUrl!);
      await framework.getByRole('button', { name: '保存框架与目标' }).click();
      await expect(framework.getByRole('status')).toContainText('配置已保存到设置');
      await page.getByRole('button', { name: '流程编排', exact: true }).click();
      await page.getByRole('button', { name: '保存草稿', exact: true }).click();
      await page.getByRole('button', { name: '新建会话', exact: true }).click();
      await page.getByRole('combobox', { name: '会话 Agent', exact: true }).selectOption('claude-native');
      await page.getByRole('combobox', { name: '已保存流程', exact: true }).selectOption('workflow');
      await page
        .getByRole('combobox', { name: '本次调用范围', exact: true })
        .selectOption({ label: '需求 → Python → 本地执行与分析 · Desktop E2E room capacity' });
      await page.locator('.session-composer textarea').fill(source);
      await page.getByRole('button', { name: '调用流程', exact: true }).click();
      record('spec_submitted_from_desktop');
    }
    const panel = page.getByRole('complementary', { name: '流程进度' });
    for (let index = 0; index < 8; index++) {
      await expect
        .poll(async () => (await readRun())?.status, { timeout: 900_000, intervals: [1000] })
        .toMatch(/^(awaiting_review|completed|failed|interrupted|cancelled)$/);
      const run = (await readRun())!;
      writeFileSync(path.join(output, 'run.json'), JSON.stringify(run, null, 2));
      if (run.status === 'completed') break;
      expect(run.status, run.errorCode).toBe('awaiting_review');
      const pending = run.plan.find(
        (node: { id: string }) => run.steps[node.id].status === 'awaiting_review',
      )!;
      record(pending.operation);
      await panel.getByRole('button', { name: '打开评审工作区', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await page.screenshot({ path: path.join(output, `${pending.operation}.png`) });
      const approve = dialog.getByRole('button', { name: '确认并继续', exact: true });
      if (pending.operation === 'review.execution')
        await dialog.locator('.session-execution-review').getByRole('checkbox').check();
      await expect(
        approve,
        `Review blocked at ${pending.operation}; inspect actual artifacts.`,
      ).toBeEnabled();
      await approve.click();
      await expect(dialog).not.toBeVisible();
    }
    const run = (await readRun())!;
    expect(run.status, run.errorCode).toBe('completed');
    expect(run.scope).toBe('verification');
    expect(run.approvals).toHaveLength(4);
    const artifacts = Object.values(run.artifacts);
    const evidence = artifacts.find((item) => item.type === 'EvidenceBundle')!.value as EvidenceBundle;
    const report = artifacts.find((item) => item.type === 'VerificationReport')!.value as VerificationReport;
    expect(evidence.results).toHaveLength(4);
    expect(report.counts).toMatchObject({ passed: 3, failed: 1, error: 0, skipped: 0 });
    expect(report.candidates.length).toBeGreaterThan(0);
    expect(report.status).toBe('candidates_found');
    await panel.getByRole('button', { name: '查看本次报告', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: path.join(output, 'final-report.png') });
    writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    writeFileSync(path.join(output, 'run.json'), JSON.stringify(run, null, 2));
    record('native_report_verified');
  } finally {
    await browser.close();
  }
});
