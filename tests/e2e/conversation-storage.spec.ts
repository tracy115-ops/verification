import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openStorageSettings, renameFirst, storageFixture } from './conversation-storage.fixture';

test('migrates only after protection and uses SQLite for writes, reload, export, clear and restore', async ({
  page,
}) => {
  await storageFixture(page);
  await page.goto('/');
  await openStorageSettings(page);
  await page.getByRole('button', { name: '检查并迁移会话' }).click();
  const confirm = page.getByRole('alertdialog', { name: '确认会话存储来源' });
  await expect(confirm).toContainText('未发现已初始化的会话库');
  expect(await page.evaluate(() => localStorage.getItem('fixture.protected'))).toBeNull();
  await confirm.getByRole('button', { name: '保护数据并启用' }).click();
  await expect(page.locator('.session-title')).toHaveText('浏览器迁移前会话');
  expect(await page.evaluate(() => !!localStorage.getItem('fixture.protected'))).toBe(true);
  await renameFirst(page, 'SQLite 中的新名称');
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem('fixture.native')!).payload)[0].title),
    )
    .toBe('SQLite 中的新名称');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].title,
    ),
  ).toBe('浏览器迁移前会话');
  await page.reload();
  await expect(page.locator('.session-title')).toHaveText('SQLite 中的新名称');
  await openStorageSettings(page);
  await expect(page.locator('.settings-conversation-store')).toContainText('会话已写入 SQLite');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出个人数据', exact: true }).click();
  const path = (await download).path();
  const file = await path;
  const backup = JSON.parse(readFileSync(file!, 'utf8'));
  expect(JSON.parse(backup.storage['verification-workbench.conversations.v1'])[0].title).toBe(
    'SQLite 中的新名称',
  );
  await page.getByRole('button', { name: '清空个人数据', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.locator('.session-history-row')).toHaveCount(0);
  await openStorageSettings(page);
  await page.locator('.settings-system-panel input[type=file]').setInputFiles(file!);
  await page.getByRole('alertdialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.locator('.session-title')).toHaveText('SQLite 中的新名称');
});

test('rejects stale writers, preserves unsaved data for export and does not rebase on retry', async ({
  page,
}) => {
  await storageFixture(page, true);
  await page.goto('/');
  await expect(page.locator('.session-title')).toHaveText('数据库会话');
  await page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem('fixture.native')!);
    value.revision += 10;
    localStorage.setItem('fixture.native', JSON.stringify(value));
  });
  await renameFirst(page, '未提交的修改');
  const warning = page.locator('.conversation-storage-warning');
  await expect(warning).toContainText('其他实例修改');
  await warning.getByRole('button', { name: '重试保存' }).click();
  await expect(warning).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(JSON.parse(localStorage.getItem('fixture.native')!).payload)[0].title,
    ),
  ).toBe('数据库会话');
  const download = page.waitForEvent('download');
  await warning.getByRole('button', { name: '导出当前会话恢复副本' }).click();
  const file = await (await download).path();
  const backup = JSON.parse(readFileSync(file!, 'utf8'));
  expect(JSON.parse(backup.storage['verification-workbench.conversations.v1'])[0].title).toBe('未提交的修改');
  await page.locator('.session-composer textarea').fill('你好');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('fixture.cli'))).toBeNull();
  await page.screenshot({ path: '.runtime/conversation-store-conflict.png' });
});

test('keeps boot errors out of the workbench until a successful retry and requires explicit fallback', async ({
  page,
}) => {
  await storageFixture(page, true);
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('fixture.read.error', 'store_corrupt'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('没有自动回退');
  await expect(page.locator('.session-history-new')).toHaveCount(0);
  await page.getByRole('button', { name: '打开旧浏览器副本', exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('缺少之后的修改');
  await confirm.getByRole('button', { name: '取消', exact: true }).click();
  await page.evaluate(() => localStorage.removeItem('fixture.read.error'));
  await page.getByRole('button', { name: '重新读取', exact: true }).click();
  await expect(page.locator('.session-title')).toHaveText('数据库会话');
});

test('does not initialize SQLite if the protective backup fails', async ({ page }) => {
  await storageFixture(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('fixture.shadow.error', 'true'));
  await openStorageSettings(page);
  await page.getByRole('button', { name: '检查并迁移会话' }).click();
  const confirm = page.getByRole('alertdialog');
  await confirm.getByRole('button', { name: '保护数据并启用' }).click();
  await expect(confirm.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fixture.native')!).revision)).toBe(0);
  expect(
    await page.evaluate(() => localStorage.getItem('verification-workbench.conversation-store.v1')),
  ).toBeNull();
});
