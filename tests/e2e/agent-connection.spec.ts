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
  const check = page.getByRole('region', { name: '连通检查 · claude / native', exact: true });
  const model = page
    .locator('.settings-model-row')
    .filter({ has: page.getByRole('textbox') })
    .filter({ hasText: 'claude / native' });
  await expect(check.getByRole('button', { name: '发送短测试' })).toBeDisabled();
  await model.getByRole('textbox').fill('fixture-model');
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
});
