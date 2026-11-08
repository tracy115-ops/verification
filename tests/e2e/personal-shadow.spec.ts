import { expect, test } from '@playwright/test';
import { en, zh } from '../../src/shared/i18n/messages';

test('creates and rechecks copies without changing personal data and clears stale success on failure', async ({
  page,
}) => {
  // Offline UI contract; real SQLite transactions are covered separately by native tests.
  await page.addInitScript(() => {
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (command: string, args: { payload?: string }) => {
          if (command === 'personal_shadow_status') {
            if (sessionStorage.getItem('shadow.fail')) throw 'shadow_corrupt';
            return JSON.parse(
              sessionStorage.getItem('shadow.result') || '{"schemaVersion":1,"snapshots":[]}',
            );
          }
          if (command === 'save_personal_shadow') {
            sessionStorage.setItem('shadow.payload', args.payload!);
            const bytes = new TextEncoder().encode(args.payload!);
            const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
              b.toString(16).padStart(2, '0'),
            ).join('');
            const value = JSON.parse(args.payload!);
            const original = localStorage.getItem('verification-workbench.conversations.v1');
            sessionStorage.setItem('shadow.original', original || '');
            const result = {
              schemaVersion: 1,
              snapshots: [
                {
                  id: 1,
                  createdAt: value.createdAt,
                  sha256: sha,
                  bytes: bytes.length,
                  sessions: JSON.parse(original || '[]').length,
                  transcripts: value.transcripts.length,
                },
              ],
            };
            sessionStorage.setItem('shadow.result', JSON.stringify(result));
            return result;
          }
          if (command === 'export_personal_shadow') {
            if (sessionStorage.getItem('shadow.fail')) throw 'shadow_corrupt';
            return sessionStorage.getItem('shadow.payload');
          }
          throw 'offline_fixture';
        },
      },
    });
  });
  await page.goto('/');
  await page.locator('.session-history-new').click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '数据管理', exact: true }).click();
  const section = page.getByRole('region', { name: '本机数据保护副本' });
  await expect(section).toContainText('尚无数据保护副本');
  await section.getByRole('button', { name: '创建并校验副本' }).click();
  await expect(section.getByRole('status')).toContainText('完整性校验通过');
  const download = page.waitForEvent('download');
  await section.getByRole('button', { name: '导出所选副本' }).click();
  expect((await download).suggestedFilename()).toBe('verification-shadow-1.json');
  expect(
    await page.evaluate(
      () =>
        localStorage.getItem('verification-workbench.conversations.v1') ===
        sessionStorage.getItem('shadow.original'),
    ),
  ).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '数据管理', exact: true }).click();
  await expect(section.getByRole('status')).toContainText('完整性校验通过');
  for (const locale of ['zh-CN', 'en-US']) {
    for (const dark of [false, true]) {
      const t = locale === 'zh-CN' ? zh : en;
      await page.setViewportSize({ width: 900, height: 650 });
      await page.evaluate(
        ({ locale, dark }) =>
          localStorage.setItem('verification-workbench.appearance.v1', JSON.stringify({ locale, dark })),
        { locale, dark },
      );
      await page.reload();
      await page.getByRole('button', { name: t.settings, exact: true }).click();
      await page.getByRole('button', { name: t.dataManagement, exact: true }).click();
      const copy = page.locator('.settings-shadow');
      await expect(copy.getByRole('status')).toContainText(t.shadowVerified);
      await copy.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const overflow = await copy.evaluate((element) => element.scrollWidth > element.clientWidth);
      expect(overflow).toBe(false);
      await page.screenshot({ path: `.runtime/shadow-${locale}-${dark ? 'dark' : 'light'}-900.png` });
    }
  }
  await page.evaluate(() =>
    localStorage.setItem(
      'verification-workbench.appearance.v1',
      JSON.stringify({ locale: 'zh-CN', dark: false }),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '数据管理', exact: true }).click();
  await page.evaluate(() => sessionStorage.setItem('shadow.fail', '1'));
  await section.getByRole('button', { name: '重新校验已存副本' }).click();
  await expect(section.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('保护副本损坏');
  await page.evaluate(() => sessionStorage.removeItem('shadow.fail'));
  await section.getByRole('button', { name: '重新校验已存副本' }).click();
  await expect(section.getByRole('status')).toContainText('完整性校验通过');
  await page.evaluate(() => sessionStorage.setItem('shadow.fail', '1'));
  await section.getByRole('button', { name: '导出所选副本' }).click();
  await expect(section.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('保护副本损坏');
  await page.setViewportSize({ width: 900, height: 650 });
  await page.getByRole('button', { name: '清空个人数据', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('不会删除保护副本');
  await page.getByRole('alertdialog').getByRole('button', { name: '取消', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
