import { chromium, expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

test('verifies source selection and its real reply in the native Release window', async () => {
  const endpoint = process.env.DESKTOP_AUDIT_ENDPOINT;
  const settingsFile = process.env.CLI_AUDIT_SETTINGS_FILE;
  const executable = process.env.CLI_AUDIT_EXECUTABLE;
  const model = process.env.CLI_AUDIT_MODEL;
  test.skip(
    !endpoint || !settingsFile || !executable || !model,
    'Explicit native source audit environment required.',
  );
  const browser = await chromium.connectOverCDP(endpoint!);
  const page = browser.contexts()[0].pages()[0];
  const output = path.resolve('.runtime/native-source-selection');
  mkdirSync(output, { recursive: true });
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
    if (process.env.DESKTOP_AUDIT_VERSION) expect(version).toBe(process.env.DESKTOP_AUDIT_VERSION);
    const open = async () => {
      await page.getByRole('button', { name: '设置', exact: true }).click();
      await page.getByRole('button', { name: 'Agent 与 Provider', exact: true }).click();
      await page.getByLabel('要配置的 Agent').selectOption('claude-native');
    };
    await open();
    const modelForm = page.locator('.settings-model-row');
    await modelForm.getByRole('textbox').fill(model!);
    await modelForm.getByRole('button', { name: '保存模型' }).click();
    const instance = page.locator('.settings-native-instance');
    await instance.locator('summary').first().click();
    await instance.getByText('高级：手动编辑路径', { exact: true }).click();
    await instance.getByLabel('CLI 启动文件的绝对路径').fill(executable!);
    await instance.getByRole('button', { name: '保存实例绑定' }).click();
    await page.getByRole('button', { name: '查找已有设置文件' }).click();
    const selected = page.locator('.settings-config-source').filter({ hasText: settingsFile! });
    await selected.getByRole('button', { name: '选用并测试' }).click();
    const check = page.getByRole('region', { name: '连通检查 · claude / native' });
    await expect(check.getByRole('status')).toContainText('短对话已验证', { timeout: 75_000 });
    await expect(selected).toHaveAttribute('data-selected', 'true');
    await expect(selected).toContainText('已选用 · 短测通过');
    await selected.screenshot({ path: path.join(output, 'selected-native.png') });
    await page.reload();
    await open();
    await page.getByRole('button', { name: '查找已有设置文件' }).click();
    await expect(selected).toContainText('已选用 · 尚未短测');
    writeFileSync(
      path.join(output, 'summary.json'),
      JSON.stringify(
        {
          version,
          nativeWindow: true,
          originalIpc: true,
          replyPassed: true,
          selectedRowPreserved: true,
          selectionPersisted: true,
          priorCheckNotReusedAfterReload: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
});
