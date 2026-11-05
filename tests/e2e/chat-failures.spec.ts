import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

for (const [driver, code] of [
  ['codex', 'cli_auth_failed'],
  ['codex', 'cli_model_unavailable'],
  ['codeagent', 'cli_model_unavailable'],
  ['codex', 'cli_failed'],
] as const) {
  test(`explains ${driver} ${code} and preserves the actual CLI identity after reload`, async ({ page }) => {
    const saved = {
      formatVersion: 1,
      revision: 1,
      definition: JSON.parse(readFileSync('docs/examples/general-testing.workflow.json', 'utf8')),
      profiles: ['codex', 'codeagent'].map((driver) => ({
        id: `${driver}-native`,
        name: driver,
        driver,
        protocol: 'native',
        model: driver === 'codeagent' ? '' : 'unavailable-fixture',
        baseUrl: '',
        credentialRef: '',
      })),
      bindings: {},
      layout: {},
      nodeTitles: {},
    };
    await page.addInitScript(
      ({ saved, code }) => {
        if (!localStorage.getItem('verification-workbench.document.v1'))
          localStorage.setItem('verification-workbench.document.v1', JSON.stringify(saved));
        Object.assign(globalThis, {
          isTauri: true,
          __TAURI_INTERNALS__: {
            transformCallback: () => 1,
            unregisterCallback: () => {},
            invoke: (command: string) =>
              command === 'send_cli_turn'
                ? Promise.resolve({
                    status: 'failed',
                    text: code === 'cli_auth_failed' ? 'Not logged in · Please run /login' : '',
                    errorCode: code,
                    nativeSessionId: null,
                  })
                : Promise.reject('offline_fixture'),
          },
        });
      },
      { saved, code },
    );
    await page.goto('/');
    await page.getByRole('combobox', { name: '会话 Agent', exact: true }).selectOption(`${driver}-native`);
    await page.locator('.session-composer textarea').fill('你好');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    const reply = page.locator('.session-message.role-assistant');
    await expect(reply).toContainText(`Agent · ${driver}`);
    await expect(reply).not.toContainText('请重试当前步骤');
    if (code === 'cli_auth_failed') {
      await expect(reply).toContainText('CLI 身份认证失败');
      await expect(reply).toContainText('系统终端');
    } else if (driver === 'codeagent') {
      await expect(reply).toContainText('无需在本应用填写模型 ID');
      await expect(reply).not.toContainText('设置中核对模型 ID');
    } else if (code === 'cli_model_unavailable') await expect(reply).toContainText('unavailable-fixture');
    else await expect(reply).toContainText('本条消息发送失败');
    await reply.getByText('调用信息', { exact: true }).click();
    await expect(reply).toContainText(code);
    if (code === 'cli_auth_failed') {
      await page.screenshot({ path: '.runtime/chat-auth-failed-light.png' });
      await page.evaluate(() => {
        document.documentElement.dataset.theme = 'dark';
      });
      await page.screenshot({ path: '.runtime/chat-auth-failed-dark.png' });
    }
    await page
      .getByRole('combobox', { name: '会话 Agent', exact: true })
      .selectOption(driver === 'codex' ? 'codeagent-native' : 'codex-native');
    await page.reload();
    await expect(reply).toContainText(`Agent · ${driver}`);
    if (code !== 'cli_failed') {
      await reply.getByRole('button', { name: '配置 Agent', exact: true }).click();
      await expect(page.getByRole('heading', { name: '本机 CLI 接入', exact: true })).toBeVisible();
    }
  });
}
