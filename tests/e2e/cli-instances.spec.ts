import { expect, test } from '@playwright/test';

test('binds a Claude instance, reloads settings and sends through that instance', async ({ page }) => {
  // Offline IPC contract: real Windows wrapper execution is covered by Rust tests.
  await page.addInitScript(() => {
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (command: string, payload: { request?: unknown }) => {
          if (command === 'send_cli_turn') {
            localStorage.setItem('fixture.last-request', JSON.stringify(payload.request));
            return { status: 'completed', text: 'INSTANCE_OK', errorCode: null, nativeSessionId: null };
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
  const instance = page.locator('.settings-native-instance').filter({ hasText: 'claude / native' });
  await instance.locator('summary').click();
  await instance.getByLabel('CLI 启动文件的绝对路径').fill('D:\\Claude One\\claude.cmd');
  await instance.getByLabel(/Claude 配置目录/).fill('D:\\Claude Config');
  await instance.getByRole('button', { name: '保存实例绑定' }).click();
  const model = page.locator('.settings-model-row').filter({ hasText: 'claude / native' });
  await model.getByRole('textbox').fill('fixture-model');
  await model.getByRole('button', { name: '保存模型' }).click();
  await page.reload();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: 'Agent 与 Provider', exact: true }).click();
  await instance.locator('summary').click();
  await expect(instance.getByLabel('CLI 启动文件的绝对路径')).toHaveValue('D:\\Claude One\\claude.cmd');
  await expect(instance.getByLabel(/Claude 配置目录/)).toHaveValue('D:\\Claude Config');
  await page.screenshot({ path: '.runtime/cli-instance-settings.png' });
  await page.getByRole('button', { name: 'CLI 会话', exact: true }).click();
  await page.getByRole('combobox', { name: '会话 Agent', exact: true }).selectOption('claude-native');
  await page.locator('.session-composer textarea').fill('你好');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(page.locator('.session-message.role-assistant')).toContainText('INSTANCE_OK');
  const request = await page.evaluate(() => JSON.parse(localStorage.getItem('fixture.last-request')!));
  expect(request.launch).toEqual({
    executablePath: 'D:\\Claude One\\claude.cmd',
    configDirectory: 'D:\\Claude Config',
  });
  expect(request.model).toBe('fixture-model');
});
