import { expect, test } from '@playwright/test';

test('switches and sends across two running conversations without mixing replies', async ({ page }) => {
  await page.addInitScript(() => {
    const pending: Record<string, (text: string) => void> = {};
    Object.assign(globalThis, {
      concurrentFixture: pending,
      isTauri: true,
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: (
          command: string,
          args: { request: { prompt: string }; onEvent: { onmessage: (event: unknown) => void } },
        ) => {
          if (command !== 'send_cli_turn') return Promise.reject('offline_fixture');
          return new Promise((resolve) => {
            pending[args.request.prompt] = (text) => {
              args.onEvent.onmessage({ type: 'text', text });
              resolve({ status: 'completed', text, errorCode: null, nativeSessionId: null });
            };
          });
        },
      },
    });
  });
  await page.goto('/');
  // Use the internal-model profile; no model inference occurs in this IPC fixture.
  await page.locator('.session-history-new').click();
  await page.getByRole('combobox', { name: '会话 Agent', exact: true }).selectOption('codeagent-native');
  await page.locator('.session-composer textarea').fill('并发任务甲');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(page.getByLabel('此会话正在后台执行')).toHaveCount(1);
  await page.locator('.session-history-new').click();
  await page.getByRole('combobox', { name: '会话 Agent', exact: true }).selectOption('codeagent-native');
  await page.locator('.session-composer textarea').fill('并发任务乙');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(page.getByLabel('此会话正在后台执行')).toHaveCount(2);
  await page.locator('.session-history-item').filter({ hasText: '并发任务甲' }).click();
  await expect(page.locator('.session-title')).toHaveText('并发任务甲');
  await page.evaluate(() => {
    const pending = (globalThis as unknown as { concurrentFixture: Record<string, (text: string) => void> })
      .concurrentFixture;
    Object.values(pending).forEach((finish, index) => finish(index === 0 ? '甲的独立回复' : '乙的独立回复'));
  });
  await expect(page.locator('.session-messages')).toContainText('甲的独立回复');
  await expect(page.locator('.session-messages')).not.toContainText('乙的独立回复');
  await page.locator('.session-history-item').filter({ hasText: '并发任务乙' }).click();
  await expect(page.locator('.session-messages')).toContainText('乙的独立回复');
  await expect(page.getByLabel('此会话正在后台执行')).toHaveCount(0);
});
