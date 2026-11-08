import { expect, test } from '@playwright/test';

test('checks the saved model on request, invalidates success after edits and reports auth failure', async ({
  page,
}) => {
  // Offline IPC contract; does not certify a real provider account.
  await page.addInitScript(() => {
    let calls = 0;
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (command: string, payload: { request?: unknown }) => {
          if (command === 'inspect_claude_setup')
            return {
              configDirectory: 'D:\\Claude Config',
              environmentAuth: false,
              settingsAuth: false,
              loginFilePresent: false,
              keyHelperPresent: false,
              endpointPresent: false,
            };
          if (command === 'read_cli_model_hints')
            return {
              status: 'found',
              candidates: [{ model: 'fixture-model', source: 'D:\\Claude Config\\settings.json' }],
            };
          if (command === 'send_cli_turn') {
            sessionStorage.setItem('connection.request', JSON.stringify(payload.request));
            calls++;
            return calls === 1
              ? {
                  status: 'completed',
                  text: 'WORKBENCH_CONNECTION_OK',
                  errorCode: null,
                  nativeSessionId: null,
                }
              : { status: 'failed', text: '', errorCode: 'cli_auth_failed', nativeSessionId: null };
          }
          if (command === 'probe_agents' || command === 'discover_cli_instances') return [];
          throw new Error('offline_fixture');
        },
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: 'Agent 与 Provider', exact: true }).click();
  await page.getByLabel('要配置的 Agent').selectOption('claude-native');
  const check = page.getByRole('region', { name: '连通检查 · claude / native', exact: true });
  const model = page
    .locator('.settings-model-row')
    .filter({ has: page.getByRole('textbox') })
    .filter({ hasText: 'claude / native' });
  await expect(check.getByRole('button', { name: '发送短测试' })).toBeDisabled();
  await page.getByRole('button', { name: '读取已有模型配置', exact: true }).click();
  await expect(page.locator('.settings-model-hints:visible')).toContainText(
    'D:\\Claude Config\\settings.json',
  );
  await page.getByRole('button', { name: '采用此模型', exact: true }).click();
  await expect(model.getByRole('textbox')).toHaveValue('fixture-model');
  await expect(check.getByRole('button', { name: '发送短测试' })).toBeDisabled();
  await page.getByLabel('要配置的 Agent').selectOption('codex-native');
  await page.getByLabel('要配置的 Agent').selectOption('claude-native');
  await expect(model.getByRole('textbox')).toHaveValue('fixture-model');
  await expect(page.locator('.settings-agent-setup:visible')).toHaveCount(1);
  await model.getByRole('button', { name: '保存模型' }).click();
  await expect(check).toContainText('可能产生费用');
  await check.getByRole('button', { name: '发送短测试' }).click();
  await expect(check.getByRole('status')).toContainText('短对话已验证');
  const request = await page.evaluate(() => JSON.parse(sessionStorage.getItem('connection.request')!));
  expect(request.model).toBe('fixture-model');
  expect(request.driver).toBe('claude');
  expect(request.timeoutSeconds).toBe(60);
  await model.getByRole('textbox').fill('changed-model');
  await model.getByRole('button', { name: '保存模型' }).click();
  await expect(check.getByText('短对话已验证', { exact: false })).toHaveCount(0);
  await check.getByRole('button', { name: '发送短测试' }).click();
  await expect(check).toContainText('CLI 身份认证失败');
  await expect(check.getByRole('status')).toContainText('连通测试未通过');
  await expect(check).toContainText('在常见来源中未发现认证配置');
  await expect(check).toContainText('桌面进程：未发现常见认证环境变量');
  await expect(check).toContainText('D:\\Claude Config');
  for (const width of [900, 1500]) {
    await page.setViewportSize({ width, height: 960 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      const setup = page.locator('.settings-agent-setup:visible');
      expect(await setup.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await setup.screenshot({ path: `.runtime/agent-setup-${width}-${theme}.png` });
    }
  }
});
