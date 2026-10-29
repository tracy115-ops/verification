import { expect, test } from '@playwright/test';

test('shows a Windows batch launcher and its internal CodeAgent version', async ({ page }) => {
  // Offline IPC fixture for UI validation; actual batch execution is covered by Rust tests.
  await page.addInitScript(() => {
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        invoke: async (command: string) => {
          if (command !== 'probe_agents') throw new Error('offline_fixture');
          return [
            {
              driver: 'codeagent',
              status: 'found',
              version: '1.2605.05.02 (codeAgentCLI)',
              executable: 'D:\\Program Files\\CodeAgentCLI\\codeagent.bat',
              reason: null,
            },
          ];
        },
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: 'Agent 与 Provider', exact: true }).click();
  await page.getByRole('button', { name: '检测本机 CLI', exact: true }).click();
  const codeagent = page
    .locator('.settings-cli')
    .filter({ has: page.getByRole('heading', { name: 'codeagent', exact: true }) });
  await expect(codeagent).toContainText('已发现 · 登录未检测');
  await expect(codeagent).toContainText('1.2605.05.02 (codeAgentCLI)');
  await expect(codeagent).toContainText('D:\\Program Files\\CodeAgentCLI\\codeagent.bat');
  const profile = page.locator('.settings-profile-row').filter({ hasText: 'codeagent / native' });
  await expect(profile).toContainText('已检测 CLI 安装');
  await expect(profile).toContainText('1.2605.05.02 (codeAgentCLI)');
  await expect(profile).not.toContainText('尚未探测');
  await page.screenshot({ path: '.runtime/codeagent-bat-detection.png' });
});
