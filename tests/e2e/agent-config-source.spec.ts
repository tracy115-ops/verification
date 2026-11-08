import { expect, test } from '@playwright/test';

test('makes selecting configuration precede testing and preserves it across reload', async ({ page }) => {
  // Offline IPC contract; the separate opt-in live suite verifies the real native calls.
  await page.addInitScript(() => {
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (command: string, payload: { request?: { launch?: { settingsFile?: string } } }) => {
          if (command === 'discover_claude_settings')
            return [
              {
                path: 'D:\\Existing Config\\settings.json',
                model: null,
                authenticationFields: false,
                backup: false,
              },
              {
                path: 'D:\\Existing Config\\settings.json.bak',
                model: 'fixture',
                authenticationFields: true,
                backup: true,
              },
            ];
          if (command === 'send_cli_turn')
            return payload.request?.launch?.settingsFile?.endsWith('.bak')
              ? {
                  status: 'completed',
                  text: 'WORKBENCH_CONNECTION_OK',
                  errorCode: null,
                  nativeSessionId: null,
                }
              : { status: 'failed', text: '', errorCode: 'cli_auth_failed', nativeSessionId: null };
          if (command === 'inspect_claude_setup')
            return {
              configDirectory: 'D:\\Existing Config',
              settingsFile: null,
              environmentAuth: false,
              settingsAuth: false,
              loginFilePresent: false,
              keyHelperPresent: false,
              endpointPresent: false,
            };
          if (command === 'probe_agents' || command === 'discover_cli_instances') return [];
          throw new Error('offline_fixture');
        },
      },
    });
  });
  await page.goto('/');
  const open = async () => {
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: 'Agent 与 Provider', exact: true }).click();
    await page.getByLabel('要配置的 Agent').selectOption('claude-native');
  };
  await open();
  const setup = page.locator('.settings-agent-setup:visible');
  await expect(setup.locator('h4').first()).toHaveText('1. 选择 CLI 与配置来源');
  await expect(setup.locator('.settings-config-summary').first()).toContainText('未选择独立设置文件');
  const model = setup.locator('.settings-model-row');
  await model.getByRole('textbox').fill('fixture');
  await model.getByRole('button', { name: '保存模型' }).click();
  const check = setup.getByRole('region', { name: '连通检查 · claude / native' });
  await check.getByRole('button', { name: '发送短测试' }).click();
  await expect(check).toContainText('CLI 身份认证失败');
  await setup.getByRole('button', { name: '查找已有设置文件' }).click();
  const backup = setup.locator('.settings-config-source').filter({ hasText: 'settings.json.bak' });
  await expect(backup).toContainText('备份文件');
  await expect(setup.locator('.settings-config-summary').first()).toContainText('未选择独立设置文件');
  await backup.getByRole('button', { name: '使用此设置文件' }).click();
  await expect(backup).toBeVisible();
  await expect(backup).toContainText('已选用 · 尚未短测');
  await expect(backup).toHaveAttribute('data-selected', 'true');
  await backup.getByRole('button', { name: '选用并测试' }).click();
  await expect(check.getByRole('status')).toContainText('短对话已验证');
  await expect(backup).toContainText('已选用 · 短测通过');
  await model.getByRole('textbox').fill('changed-fixture');
  await expect(backup.getByRole('button', { name: '选用并测试' })).toBeDisabled();
  await model.getByRole('button', { name: '保存模型' }).click();
  await expect(backup).toContainText('已选用 · 尚未短测');
  await page.reload();
  await open();
  await expect(setup.locator('.settings-config-summary').first()).toContainText(
    'D:\\Existing Config\\settings.json.bak',
  );
  await expect(check.getByText('短对话已验证', { exact: false })).toHaveCount(0);
  for (const width of [900, 1500]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await setup.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
  await page.getByLabel('要配置的 Agent').selectOption('codex-native');
  await page.locator('.settings-model-row').getByRole('textbox').fill('GPT-6.1 Terra');
  await expect(page.locator('.settings-agent-setup:visible')).toContainText('可能是界面显示名而非模型 ID');
});

test('cancels a source-initiated check through the shared connection controls', async ({ page }) => {
  await page.addInitScript(() => {
    let finish: (outcome: unknown) => void = () => {};
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (command: string) => {
          if (command === 'discover_claude_settings')
            return [
              {
                path: 'D:\\Config\\settings.json.bak',
                model: 'fixture',
                backup: true,
                authenticationFields: true,
              },
            ];
          if (command === 'send_cli_turn')
            return new Promise((resolve) => {
              finish = resolve;
            });
          if (command === 'cancel_cli_turn') {
            finish({ status: 'cancelled', text: '', errorCode: 'cancelled', nativeSessionId: null });
            return;
          }
          if (command === 'probe_agents') return [];
          throw new Error('offline_fixture');
        },
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: 'Agent 与 Provider', exact: true }).click();
  await page.getByLabel('要配置的 Agent').selectOption('claude-native');
  const model = page.locator('.settings-model-row');
  await model.getByRole('textbox').fill('fixture');
  await model.getByRole('button', { name: '保存模型' }).click();
  await page.getByRole('button', { name: '查找已有设置文件' }).click();
  const source = page.locator('.settings-config-source');
  await source.getByRole('button', { name: '选用并测试' }).click();
  await expect(source).toContainText('正在测试回复');
  const check = page.getByRole('region', { name: '连通检查 · claude / native' });
  await check.getByRole('button', { name: '取消本次调用' }).click();
  await expect(check.getByRole('status')).toContainText('连通测试未通过');
  await expect(source).toContainText('已选用 · 短测未通过');
});
