import { expect, test } from '@playwright/test';

test('binds a Claude instance, reloads settings and sends through that instance', async ({ page }) => {
  // Offline IPC contract: real Windows wrapper execution is covered by Rust tests.
  await page.addInitScript(() => {
    let fileSelections = 0;
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (command: string, payload: { request?: unknown; kind?: string }) => {
          if (command === 'discover_cli_instances')
            return [
              { driver: 'claude', executablePath: 'D:\\Claude One\\claude.cmd' },
              { driver: 'claude', executablePath: 'D:\\Claude Two\\claude.exe' },
            ];
          if (command === 'pick_cli_path') {
            if (payload.kind === 'configuration') return 'D:\\Claude Config';
            if (payload.kind === 'settings') return 'D:\\Claude Config\\custom.json.bak';
            return fileSelections++ === 0 ? null : 'D:\\Claude One\\claude.cmd';
          }
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
  await page.getByLabel('要配置的 Agent').selectOption('claude-native');
  const instance = page.locator('.settings-native-instance').filter({ hasText: 'claude / native' });
  await instance.locator('summary').first().click();
  await expect(instance.getByRole('option', { name: 'D:\\Claude Two\\claude.exe', exact: true })).toHaveCount(
    1,
  );
  await expect(instance.getByLabel('CLI 启动文件的绝对路径')).not.toBeVisible();
  await instance.getByLabel('选择本机实例').selectOption('D:\\Claude Two\\claude.exe');
  await instance.getByRole('button', { name: '选择启动文件…' }).click();
  await expect(instance.getByLabel('选择本机实例')).toHaveValue('D:\\Claude Two\\claude.exe');
  await instance.getByRole('button', { name: '选择启动文件…' }).click();
  await expect(instance.getByLabel('选择本机实例')).toHaveValue('D:\\Claude One\\claude.cmd');
  await instance.getByRole('button', { name: '选择配置目录…' }).click();
  await instance.getByRole('button', { name: '选择设置文件…' }).click();
  await instance.getByRole('button', { name: '保存实例绑定' }).click();
  const model = page.locator('.settings-model-row').filter({ hasText: 'claude / native' });
  await model.getByRole('textbox').fill('fixture-model');
  await model.getByRole('button', { name: '保存模型' }).click();
  await page.reload();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: 'Agent 与 Provider', exact: true }).click();
  await page.getByLabel('要配置的 Agent').selectOption('claude-native');
  await instance.locator('summary').first().click();
  await expect(instance.getByLabel('选择本机实例')).toHaveValue('D:\\Claude One\\claude.cmd');
  await expect(instance.locator('.settings-instance-path')).toHaveText([
    'D:\\Claude Config',
    'D:\\Claude Config\\custom.json.bak',
  ]);
  await page.screenshot({ path: '.runtime/cli-instance-settings.png' });
  for (const width of [900, 1500]) {
    await page.setViewportSize({ width, height: 960 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      expect(await instance.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await instance.screenshot({ path: `.runtime/cli-instance-${width}-${theme}.png` });
    }
  }
  await page.getByRole('button', { name: 'CLI 会话', exact: true }).click();
  await page.getByRole('combobox', { name: '会话 Agent', exact: true }).selectOption('claude-native');
  await page.locator('.session-composer textarea').fill('你好');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(page.locator('.session-message.role-assistant')).toContainText('INSTANCE_OK');
  const request = await page.evaluate(() => JSON.parse(localStorage.getItem('fixture.last-request')!));
  expect(request.launch).toEqual({
    executablePath: 'D:\\Claude One\\claude.cmd',
    configDirectory: 'D:\\Claude Config',
    settingsFile: 'D:\\Claude Config\\custom.json.bak',
  });
  expect(request.model).toBe('fixture-model');
});
