import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('shows actual workflow Agent and blocks invalid configuration without losing the Spec', async ({
  page,
}) => {
  // Offline UI/IPC contract. This test makes no model or target availability claim.
  const definition = JSON.parse(readFileSync('docs/examples/general-testing.workflow.json', 'utf8'));
  const profiles = ['codex', 'codeagent'].map((driver) => ({
    id: `${driver}-native`,
    name: driver,
    driver,
    protocol: 'native',
    model: '',
    baseUrl: '',
    credentialRef: '',
  }));
  const saved = {
    formatVersion: 1,
    revision: 3,
    definition,
    profiles,
    bindings: {},
    layout: {},
    nodeTitles: {},
  };
  await page.addInitScript((saved) => {
    localStorage.setItem('verification-workbench.document.v1', JSON.stringify(saved));
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: (command: string) => {
          if (command === 'send_cli_turn') {
            sessionStorage.setItem(
              'preparation.calls',
              String(Number(sessionStorage.getItem('preparation.calls') || 0) + 1),
            );
            return new Promise(() => {});
          }
          return Promise.reject('offline_fixture');
        },
      },
    });
  }, saved);
  await page.goto('/');
  const composer = page.locator('.session-composer');
  const input = composer.locator('textarea');
  await composer.getByRole('combobox', { name: '已保存流程' }).selectOption('workflow');
  await input.fill('房间人数限制为2至8，覆盖边界。');
  const check = composer.locator('.session-preparation');
  await expect(check.locator('summary')).toContainText('配置待补齐');
  const send = composer.getByRole('button', { name: '调用流程', exact: true });
  await expect(send).toBeDisabled();
  await input.press('Enter');
  await expect(input).toHaveValue('房间人数限制为2至8，覆盖边界。');
  expect(await page.evaluate(() => sessionStorage.getItem('preparation.calls'))).toBeNull();
  await check.locator('summary').click();
  await expect(check.getByRole('list', { name: '配置待补齐' })).toContainText('模型');
  await expect(check).toContainText('当前配置尚未做短对话测试');
  await composer.getByRole('combobox', { name: '会话 Agent' }).selectOption('codeagent-native');
  await expect(check.locator('summary')).toContainText('本地配置齐备');
  await expect(check).toContainText('仅设计评审');
  await expect(send).toBeEnabled();
  // A malformed slash command must not crash React or silently create a task.
  await input.fill('/run wrong');
  await expect(send).toBeDisabled();
  await input.press('Enter');
  await expect(input).toHaveValue('/run wrong');
  await input.fill(`/run ${definition.id} 测试房间边界`);
  await expect(send).toBeEnabled();
  await check.locator('summary').click();
  await expect(check).not.toHaveAttribute('open');
  await page.screenshot({ path: '.runtime/preparation-collapsed.png' });
  await check.locator('summary').click();
  await page.screenshot({ path: '.runtime/preparation-expanded.png' });
  for (const locale of ['zh-CN', 'en-US']) {
    for (const dark of [false, true]) {
      await page.setViewportSize({ width: 900, height: 650 });
      await page.evaluate(
        ({ locale, dark }) => {
          localStorage.setItem('verification-workbench.appearance.v1', JSON.stringify({ locale, dark }));
        },
        { locale, dark },
      );
      await page.reload();
      await check.locator('summary').click();
      await expect(check.locator('.session-preparation-body')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const bounds = await check.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(900);
      const sendBounds = await composer.locator('.session-composer-actions button').last().boundingBox();
      expect(sendBounds!.y).toBeGreaterThanOrEqual(0);
      expect(sendBounds!.y + sendBounds!.height).toBeLessThanOrEqual(650);
      await page.screenshot({ path: `.runtime/preparation-${locale}-${dark ? 'dark' : 'light'}-900.png` });
    }
  }
  await input.press('Enter');
  await expect
    .poll(() => page.evaluate(() => Number(sessionStorage.getItem('preparation.calls') || 0)))
    .toBe(1);
  await expect(input).toHaveValue('');
});
