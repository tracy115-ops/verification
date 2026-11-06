import { expect, test } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { TurnOutcome, TurnRequest } from '../../src/domain/runtime/types';

test('selects a real settings source in the UI, persists it, and completes a real CLI check', async ({
  page,
}) => {
  const settingsFile = process.env.CLI_AUDIT_SETTINGS_FILE;
  const model = process.env.CLI_AUDIT_MODEL;
  test.skip(!settingsFile || !model, 'Set CLI_AUDIT_SETTINGS_FILE and CLI_AUDIT_MODEL to opt in.');
  const folder = path.resolve('.runtime/live-settings-ui');
  mkdirSync(folder, { recursive: true });
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (key.startsWith('ANTHROPIC_') || key === 'CLAUDE_CODE_OAUTH_TOKEN') delete env[key];
  const turns: { request: TurnRequest; outcome: TurnOutcome }[] = [];
  function native(binary: string, request: unknown): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        path.resolve(`target/debug/examples/${binary}${process.platform === 'win32' ? '.exe' : ''}`),
        [folder],
        { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
      );
      let stdout = '';
      const timer = setTimeout(() => child.kill(), 80_000);
      child.stdout.on('data', (data) => {
        stdout += data;
        if (stdout.length > 4_000_000) child.kill();
      });
      child.stderr.resume();
      child.on('error', reject);
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(stdout);
        else reject(new Error('native_audit_failed'));
      });
      child.stdin.on('error', () => {});
      child.stdin.end(JSON.stringify(request));
    });
  }
  await page.exposeFunction(
    'nativeAuditInvoke',
    async (command: string, payload: Record<string, unknown>) => {
      if (command === 'send_cli_turn') {
        const request = payload.request as TurnRequest;
        const output = await native('turn', request);
        const outcome = output
          .trim()
          .split(/\r?\n/)
          .map((line) => JSON.parse(line))
          .findLast((item) => item.outcome)?.outcome;
        turns.push({ request, outcome });
        return outcome;
      }
      if (['discover_claude_settings', 'inspect_claude_setup', 'read_cli_model_hints'].includes(command))
        return JSON.parse(await native('configuration', { ...payload, operation: command }));
      if (command === 'probe_agents' || command === 'discover_cli_instances') return [];
      throw new Error('audit_unsupported_command');
    },
  );
  const profiles = [
    {
      id: 'claude-native',
      name: 'claude / native',
      driver: 'claude',
      protocol: 'native',
      model: model!,
      baseUrl: '',
      credentialRef: '',
      ...(process.env.CLI_AUDIT_EXECUTABLE
        ? { launch: { executablePath: process.env.CLI_AUDIT_EXECUTABLE } }
        : {}),
    },
  ];
  await page.addInitScript((profiles) => {
    localStorage.setItem(
      'verification-workbench.profiles.v1',
      localStorage.getItem('verification-workbench.profiles.v1') ?? JSON.stringify(profiles),
    );
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: (command: string, payload: Record<string, unknown>) =>
          (
            globalThis as unknown as {
              nativeAuditInvoke: (command: string, payload: Record<string, unknown>) => Promise<unknown>;
            }
          ).nativeAuditInvoke(command, payload),
      },
    });
  }, profiles);
  await page.goto('/');
  const openSettings = async () => {
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: 'Agent 与 Provider', exact: true }).click();
    await page.getByLabel('要配置的 Agent').selectOption('claude-native');
  };
  await openSettings();
  const check = page.getByRole('region', { name: '连通检查 · claude / native', exact: true });
  await check.getByRole('button', { name: '发送短测试' }).click();
  await expect(check.getByRole('status')).toContainText('连通测试未通过', { timeout: 75_000 });
  expect(turns[0].outcome.errorCode).toBe('cli_auth_failed');
  await page.getByRole('button', { name: '查找已有设置文件', exact: true }).click();
  const candidate = page.locator('.settings-config-source').filter({ hasText: settingsFile! });
  await expect(candidate).toContainText('含认证字段');
  await candidate.getByRole('button', { name: '使用此设置文件' }).click();
  await page.reload();
  await openSettings();
  await expect(page.locator('.settings-agent-setup > section').first()).toContainText(settingsFile!);
  await check.getByRole('button', { name: '发送短测试' }).click();
  await expect(check.getByRole('status')).toContainText('短对话已验证', { timeout: 75_000 });
  expect(turns[1].request.launch?.settingsFile).toBe(settingsFile);
  expect(turns[1].request.launch?.executablePath).toBe(process.env.CLI_AUDIT_EXECUTABLE);
  expect(turns[1].outcome.text.trim()).toBe('WORKBENCH_CONNECTION_OK');
  await page.screenshot({ path: path.join(folder, 'configured.png'), fullPage: true });
  writeFileSync(
    path.join(folder, 'summary.json'),
    JSON.stringify(
      {
        temporaryAuthRemoved: true,
        before: turns[0].outcome.errorCode,
        after: turns[1].outcome.status,
        settingsBound: true,
        model,
        nativeWindow: false,
      },
      null,
      2,
    ),
  );
});
