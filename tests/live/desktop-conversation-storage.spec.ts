import { chromium, expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { WorkflowRun } from '../../src/domain/runtime/types';

test('migrates historical conversations through original IPC in an isolated audit application', async () => {
  test.skip(
    process.env.DESKTOP_STORAGE_PHASE !== 'migrate',
    'Explicit isolated database namespace required.',
  );
  const browser = await chromium.connectOverCDP(process.env.DESKTOP_AUDIT_ENDPOINT!);
  const page = browser.contexts()[0].pages()[0];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const output = path.resolve('.runtime/native-conversation-storage');
  mkdirSync(output, { recursive: true });
  try {
    expect(page.url()).toContain('tauri.localhost');
    const identifier = await page.evaluate(() =>
      (
        window as unknown as { __TAURI_INTERNALS__: { invoke: (command: string) => Promise<string> } }
      ).__TAURI_INTERNALS__.invoke('plugin:app|identifier'),
    );
    expect(identifier).toBe(process.env.DESKTOP_STORAGE_IDENTIFIER);
    expect(identifier).toMatch(/^dev\.verification\.workbench\.audit/);
    const run = JSON.parse(
      readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
    ) as WorkflowRun;
    await page.evaluate((run) => {
      localStorage.setItem(
        'verification-workbench.conversations.v1',
        JSON.stringify([
          {
            id: run.sessionId,
            title: '原生事务迁移验收',
            profileId: 'codeagent-native',
            messages: [],
            runs: [run],
            draft: {
              text: '保留未发送题目',
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
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '数据管理', exact: true }).click();
    await page.getByRole('button', { name: '检查并迁移会话' }).click();
    const dialog = page.getByRole('alertdialog', { name: '确认会话存储来源' });
    await expect(dialog).toContainText('未发现已初始化的会话库');
    await page.screenshot({ path: path.join(output, 'migration-preview.png') });
    await dialog.getByRole('button', { name: '保护数据并启用' }).click();
    await expect(page.locator('.session-title')).toHaveText('原生事务迁移验收');
    await expect(page.locator('.session-composer textarea')).toHaveValue('保留未发送题目');
    await page.locator('.session-history-row').first().getByRole('button', { name: '会话操作' }).click();
    await page.getByRole('button', { name: '重命名会话', exact: true }).filter({ visible: true }).click();
    await page.getByRole('dialog').getByLabel('会话名称', { exact: true }).fill('SQLite 提交后重启验收');
    await page.getByRole('dialog').getByRole('button', { name: '保存名称' }).click();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '数据管理', exact: true }).click();
    await expect(page.locator('.settings-conversation-store')).toContainText('会话已写入 SQLite');
    await expect(page.locator('.settings-conversation-store')).toContainText('已提交版本 · 2');
    await page.screenshot({ path: path.join(output, 'committed.png') });
    expect(errors).toEqual([]);
    writeFileSync(
      path.join(output, 'migration-summary.json'),
      JSON.stringify(
        { originalIpc: true, historicalFixture: true, freshModelCall: false, phase: 'migrated', errors },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
});

test('reads committed data after restarting the isolated native process', async () => {
  test.skip(
    process.env.DESKTOP_STORAGE_PHASE !== 'restart',
    'Run after restarting the owned isolated audit process.',
  );
  const browser = await chromium.connectOverCDP(process.env.DESKTOP_AUDIT_ENDPOINT!);
  const page = browser.contexts()[0].pages()[0];
  const output = path.resolve('.runtime/native-conversation-storage');
  try {
    expect(page.url()).toContain('tauri.localhost');
    const identifier = await page.evaluate(() =>
      (
        window as unknown as { __TAURI_INTERNALS__: { invoke: (command: string) => Promise<string> } }
      ).__TAURI_INTERNALS__.invoke('plugin:app|identifier'),
    );
    expect(identifier).toBe(process.env.DESKTOP_STORAGE_IDENTIFIER);
    expect(identifier).toMatch(/^dev\.verification\.workbench\.audit/);
    await expect(page.locator('.session-title')).toHaveText('SQLite 提交后重启验收');
    await expect(page.locator('.session-composer textarea')).toHaveValue('保留未发送题目');
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].title,
      ),
    ).toBe('原生事务迁移验收');
    await page.getByRole('button', { name: '验证资产', exact: true }).click();
    await page.getByRole('button', { name: '测试用例', exact: true }).click();
    await expect(page.locator('.assets-list')).toContainText('B1-C1');
    await page.screenshot({ path: path.join(output, 'restarted-assets.png') });
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '数据管理', exact: true }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出个人数据', exact: true }).click();
    const file = await (await download).path();
    const restored = JSON.parse(
      JSON.parse(readFileSync(file!, 'utf8')).storage['verification-workbench.conversations.v1'],
    )[0];
    const original = JSON.parse(
      readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
    );
    expect(JSON.stringify(restored.runs[0].artifacts)).toBe(JSON.stringify(original.artifacts));
    expect(restored.runs[0].approvals).toEqual(original.approvals);
    await page.getByRole('button', { name: '在线升级', exact: true }).click();
    const version = await page.locator('.settings-version-row strong').textContent();
    expect(version).toBe('0.15.0');
    writeFileSync(
      path.join(output, 'restart-summary.json'),
      JSON.stringify(
        {
          version,
          originalIpc: true,
          historicalFixture: true,
          freshModelCall: false,
          databaseMainRead: true,
          oldBrowserSourceRetained: true,
          composerAndRunRetained: true,
          artifactOrderAndApprovalsRetained: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
});
