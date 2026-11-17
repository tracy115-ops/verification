import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function setup(page: Page) {
  // Offline IPC/UI contract. Native parser behavior is tested separately.
  await page.addInitScript(() => {
    let finish: ((value: unknown) => void) | undefined;
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (command: string, args: { request?: { source: string } }) => {
          if (command === 'send_cli_turn') sessionStorage.setItem('inspection.agentCalled', 'true');
          if (command === 'cancel_python') {
            sessionStorage.setItem('inspection.cancelled', 'true');
            finish?.(null);
            return;
          }
          if (command !== 'inspect_framework') throw new Error('offline_fixture');
          const source = args.request!.source;
          if (source.includes('WAIT'))
            return new Promise((resolve) => {
              finish = resolve;
            });
          const missing = !source.includes('BlackBoxCase');
          const sourceSha256 = Array.from(
            new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))),
            (byte) => byte.toString(16).padStart(2, '0'),
          ).join('');
          return {
            version: 1,
            pythonVersion: '3.12.0',
            sourceSha256,
            hints: [],
            checks: [
              { code: 'python', status: 'ok', reason: 'python_supported', line: null },
              { code: 'syntax', status: 'ok', reason: 'syntax_valid', line: null },
              { code: 'limits', status: 'ok', reason: 'limits_valid', line: null },
              {
                code: 'entry',
                status: missing ? 'error' : 'ok',
                reason: missing ? 'entry_missing' : 'entry_declared',
                line: missing ? null : 2,
              },
            ],
          };
        },
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '测试框架与执行', exact: true }).click();
}

test('inspects imported source, locates its entry and invalidates applicability after edits', async ({
  page,
}) => {
  await setup(page);
  const report = page.getByRole('region', { name: '框架接入检查', exact: true });
  const source = page.getByRole('textbox', { name: 'framework.py 源码', exact: true });
  const text = 'import unittest\nclass BlackBoxCase(unittest.TestCase):\n    pass\n';
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'framework.py', mimeType: 'text/x-python', buffer: Buffer.from(text) });
  await expect(source).toHaveValue(text);
  await report.getByRole('button', { name: '检查当前框架', exact: true }).click();
  await expect(report).toContainText('语法及入口声明检查完成');
  await expect(report.locator('details')).not.toHaveAttribute('open');
  await report.locator('summary').click();
  await report.getByRole('button', { name: '第 2 行', exact: true }).click();
  await expect(source).toBeFocused();
  expect(
    await source.evaluate((field: HTMLTextAreaElement) =>
      field.value.slice(field.selectionStart, field.selectionEnd),
    ),
  ).toBe('class BlackBoxCase(unittest.TestCase):');
  await source.fill('import unittest\n');
  await expect(report).toContainText('尚未检查当前源码与解释器');
  await report.getByRole('button', { name: '检查当前框架', exact: true }).click();
  await expect(report).toContainText('发现框架接入问题');
  await expect(report.locator('details')).toHaveAttribute('open');
  await expect(report).toContainText('未找到 BlackBoxCase 导出入口');
  for (const width of [900, 1500]) {
    await page.setViewportSize({ width, height: 960 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      expect(await report.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await report.screenshot({ path: `.runtime/framework-inspection-${width}-${theme}.png` });
    }
  }
  await page
    .locator('.settings-framework-form')
    .getByRole('button', { name: '保存框架与目标', exact: true })
    .click();
  await expect(page.locator('.settings-framework-form').getByRole('status')).toContainText('配置已保存');
  await page.reload();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '测试框架与执行', exact: true }).click();
  await expect(source).toHaveValue('import unittest\n');
  await expect(report).toContainText('尚未检查当前源码与解释器');
  await page.evaluate(() =>
    localStorage.setItem(
      'verification-workbench.appearance.v1',
      JSON.stringify({ locale: 'en-US', dark: true }),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Test frameworks & execution', exact: true }).click();
  const english = page.getByRole('region', { name: 'Framework admission checks', exact: true });
  await english.getByRole('button', { name: 'Inspect current framework', exact: true }).click();
  await expect(english).toContainText('No BlackBoxCase export was found');
  await expect(english).toContainText('Needs correction');
  await english.screenshot({ path: '.runtime/framework-inspection-english-dark.png' });
});

test('cancels a pending inspection without adopting its late response', async ({ page }) => {
  await setup(page);
  const report = page.getByRole('region', { name: '框架接入检查', exact: true });
  await page.getByRole('textbox', { name: 'framework.py 源码', exact: true }).fill('# WAIT\n');
  await report.getByRole('button', { name: '检查当前框架', exact: true }).click();
  await expect(report).toContainText('正在解析框架');
  await report.getByRole('button', { name: '取消检查', exact: true }).click();
  await expect(report.getByRole('alert')).toContainText('静态检查已取消');
  await expect(report).toContainText('尚未检查当前源码与解释器');
  expect(await page.evaluate(() => sessionStorage.getItem('inspection.cancelled'))).toBe('true');
});

test('blocks known framework issues before invoking an Agent and retains design-only access', async ({
  page,
}) => {
  const definition = JSON.parse(readFileSync('docs/examples/general-testing.workflow.json', 'utf8'));
  await page.addInitScript((definition) => {
    localStorage.setItem(
      'verification-workbench.document.v1',
      JSON.stringify({
        formatVersion: 1,
        revision: 1,
        definition,
        bindings: {},
        layout: {},
        nodeTitles: {},
        profiles: [
          {
            id: 'codeagent-native',
            name: 'codeagent',
            driver: 'codeagent',
            protocol: 'native',
            model: '',
            baseUrl: '',
            credentialRef: '',
          },
        ],
      }),
    );
  }, definition);
  await setup(page);
  await page.getByRole('textbox', { name: 'framework.py 源码', exact: true }).fill('import unittest\n');
  const report = page.getByRole('region', { name: '框架接入检查', exact: true });
  await report.getByRole('button', { name: '检查当前框架', exact: true }).click();
  await expect(report).toContainText('发现框架接入问题');
  await page.getByRole('button', { name: '保存框架与目标', exact: true }).click();
  await page.getByRole('button', { name: 'CLI 会话', exact: true }).click();
  const composer = page.locator('.session-composer');
  await composer.getByLabel('会话 Agent').selectOption('codeagent-native');
  await composer.getByLabel('已保存流程').selectOption('workflow');
  await composer.getByLabel('本次调用范围').selectOption('game-unittest');
  const input = composer.locator('textarea');
  await input.fill('验证房间容量边界，不丢失这份需求。');
  const send = composer.getByRole('button', { name: '调用流程', exact: true });
  await expect(send).toBeDisabled();
  await input.press('Enter');
  await expect(input).toHaveValue('验证房间容量边界，不丢失这份需求。');
  expect(await page.evaluate(() => sessionStorage.getItem('inspection.agentCalled'))).toBeNull();
  await composer.locator('.session-preparation summary').click();
  await expect(composer.locator('.session-preparation')).toContainText('当前框架已有明确的静态检查问题');
  await composer.getByLabel('本次调用范围').selectOption('');
  await expect(send).toBeEnabled();
});
