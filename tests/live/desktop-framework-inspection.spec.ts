import { chromium, expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

test('inspects frameworks through original desktop IPC without executing their code', async () => {
  test.skip(!process.env.DESKTOP_INSPECTION_IDENTIFIER, 'Explicit isolated native application required.');
  const browser = await chromium.connectOverCDP(process.env.DESKTOP_AUDIT_ENDPOINT!);
  const page = browser.contexts()[0].pages()[0];
  const output = path.resolve('.runtime/native-framework-inspection');
  mkdirSync(output, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    expect(page.url()).toContain('tauri.localhost');
    const identifier = await page.evaluate(() =>
      (
        window as unknown as { __TAURI_INTERNALS__: { invoke: (command: string) => Promise<string> } }
      ).__TAURI_INTERNALS__.invoke('plugin:app|identifier'),
    );
    expect(identifier).toBe(process.env.DESKTOP_INSPECTION_IDENTIFIER);
    expect(identifier).toMatch(/^dev\.verification\.workbench\.audit/);
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '测试框架与执行', exact: true }).click();
    const source = page.getByRole('textbox', { name: 'framework.py 源码', exact: true });
    const report = page.getByRole('region', { name: '框架接入检查', exact: true });
    const inspect = report.getByRole('button', { name: '检查当前框架', exact: true });
    // Success with this top-level raise proves the framework was not imported.
    const text =
      'import unittest\nraise RuntimeError("MUST_NOT_EXECUTE")\nclass BlackBoxCase(unittest.TestCase):\n    def setUp(self):\n        raise RuntimeError("MUST_NOT_RESET")\n';
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'framework.py', mimeType: 'text/x-python', buffer: Buffer.from(text) });
    await expect(source).toHaveValue(text);
    await inspect.click();
    await expect(report).toContainText('语法及入口声明检查完成');
    await report.locator('summary').click();
    await expect(report).toContainText('发现 setUp 声明');
    await report.getByRole('button', { name: '第 3 行', exact: true }).click();
    await expect(source).toBeFocused();
    expect(
      await source.evaluate((field: HTMLTextAreaElement) =>
        field.value.slice(field.selectionStart, field.selectionEnd),
      ),
    ).toBe('class BlackBoxCase(unittest.TestCase):');
    await report.screenshot({ path: path.join(output, 'declarations-native.png') });
    await source.fill('import unittest\nclass BlackBoxCase(\n');
    await expect(report).toContainText('尚未检查当前源码与解释器');
    await inspect.click();
    await expect(report).toContainText('源码存在语法错误');
    await expect(report.locator('details')).toHaveAttribute('open');
    await report.screenshot({ path: path.join(output, 'syntax-native.png') });
    await source.fill('from missing_sdk import BlackBoxCase\n');
    await inspect.click();
    await expect(report).toContainText('部分检查仍需运行确认');
    await report.locator('summary').click();
    await expect(report).toContainText('入口通过导入、赋值或动态方式提供');
    await source.fill('import unittest\n');
    await inspect.click();
    await expect(report).toContainText('未找到 BlackBoxCase 导出入口');
    await page.getByRole('button', { name: '保存框架与目标', exact: true }).click();
    await expect(page.locator('.settings-framework-form').getByRole('status')).toContainText('配置已保存');
    for (const width of [900, 1500]) {
      await page.setViewportSize({ width, height: 960 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((theme) => {
          document.documentElement.dataset.theme = theme;
        }, theme);
        expect(await report.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        await report.screenshot({ path: path.join(output, `issues-${width}-${theme}.png`) });
      }
    }
    await page.reload();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '测试框架与执行', exact: true }).click();
    await expect(source).toHaveValue('import unittest\n');
    await expect(report).toContainText('尚未检查当前源码与解释器');
    expect(errors).toEqual([]);
    writeFileSync(
      path.join(output, 'summary.json'),
      JSON.stringify(
        {
          identifier,
          originalIpc: true,
          realPython: true,
          frameworkImported: false,
          freshModelCall: false,
          targetRequests: false,
          topLevelRaiseNotExecuted: true,
          syntaxErrorLocated: true,
          dynamicExportUnverified: true,
          missingEntryBlocked: true,
          savedSourceRetained: true,
          sessionCheckExpiresOnReload: true,
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
});
