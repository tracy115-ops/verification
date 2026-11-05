import { expect, test } from '@playwright/test';

for (const width of [900, 1120])
  test(`manages conversations through the compact history picker at width ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 768 });
    await page.addInitScript(() => {
      if (!localStorage.getItem('verification-workbench.conversations.v1'))
        localStorage.setItem(
          'verification-workbench.conversations.v1',
          JSON.stringify(
            ['甲项目设计', '乙项目复核'].map((title, i) => ({
              id: `compact-${i}`,
              title,
              profileId: 'codex-native',
              messages: [],
              runs: [],
            })),
          ),
        );
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: '新建会话', exact: true })).toBeVisible();
    await expect(page.locator('.session-history-list')).toBeHidden();
    const search = page.getByRole('button', { name: '搜索会话', exact: true });
    await search.click();
    let picker = page.getByRole('dialog', { name: '搜索会话', exact: true });
    const row = picker.locator('.session-search-row').filter({ hasText: '甲项目设计' });
    await row.click({ button: 'right' });
    await page.locator(':popover-open').getByRole('button', { name: '重命名会话', exact: true }).click();
    const rename = page.getByRole('dialog', { name: '重命名会话', exact: true });
    await rename.getByRole('textbox').fill('甲项目已复核');
    await rename.getByRole('button', { name: '保存名称', exact: true }).click();
    await expect(picker).toContainText('甲项目已复核');
    await page.screenshot({ path: `.runtime/compact-history-${width}.png` });
    await picker.getByRole('button', { name: '甲项目已复核', exact: true }).click();
    await expect(page.locator('.session-toolbar')).toContainText('甲项目已复核');
    await search.click();
    picker = page.getByRole('dialog', { name: '搜索会话', exact: true });
    await picker
      .locator('.session-search-row')
      .filter({ hasText: '甲项目已复核' })
      .getByRole('button', { name: '会话操作', exact: true })
      .click();
    await page.locator(':popover-open').getByRole('button', { name: '验证资产', exact: true }).click();
    await expect(picker).not.toBeVisible();
    await expect(page.locator('.assets-context h1')).toHaveText('甲项目已复核');
    await search.click();
    picker = page.getByRole('dialog', { name: '搜索会话', exact: true });
    await picker
      .locator('.session-search-row')
      .filter({ hasText: '乙项目复核' })
      .getByRole('button', { name: '会话操作', exact: true })
      .click();
    await page.locator(':popover-open').getByRole('button', { name: '删除会话', exact: true }).click();
    const remove = page.getByRole('dialog', { name: '删除会话', exact: true });
    await remove.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(picker).not.toContainText('乙项目复核');
    await page.keyboard.press('Escape');
    await expect(picker).not.toBeVisible();
    await page.reload();
    await search.click();
    await expect(page.getByRole('dialog', { name: '搜索会话', exact: true })).toContainText('甲项目已复核');
    await expect(page.getByRole('dialog', { name: '搜索会话', exact: true })).not.toContainText('乙项目复核');
  });
