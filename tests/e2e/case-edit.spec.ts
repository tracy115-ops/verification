import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { WorkflowRun } from '../../src/domain/runtime/types';

const original = JSON.parse(
  readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
) as WorkflowRun;
test.beforeEach(async ({ page }) => {
  await page.addInitScript((run) => {
    if (!localStorage.getItem('verification-workbench.conversations.v1'))
      localStorage.setItem(
        'verification-workbench.conversations.v1',
        JSON.stringify([
          {
            id: run.sessionId,
            title: '用例人工补充验收',
            profileId: 'codeagent-native',
            messages: [],
            runs: [run],
          },
        ]),
      );
  }, original);
  await page.goto('/');
  await page.getByRole('button', { name: '验证资产', exact: true }).click();
  await page.getByRole('button', { name: '测试用例', exact: true }).click();
});

test('edits and duplicates cases without replacing confirmed requirements or scenarios', async ({ page }) => {
  await page.getByRole('button', { name: '编辑用例', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '补充测试用例' });
  await editor.getByLabel('用例名称', { exact: true }).fill('明确房间创建的状态码断言');
  await editor.getByRole('button', { name: '2 · 步骤与断言' }).click();
  await editor.getByLabel('具体断言（每行一项）', { exact: true }).fill('response.status == 201');
  await editor.getByRole('button', { name: '3 · 变更说明' }).click();
  await editor.getByLabel('本次修改原因', { exact: true }).fill('核对题目已明确的状态码断言');
  await editor.getByRole('button', { name: '保存并评审用例', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(page.locator('.assets-list')).toContainText('明确房间创建的状态码断言');
  await page.getByRole('button', { name: '复制用例', exact: true }).click();
  await editor.getByLabel('用例名称', { exact: true }).fill('独立房间创建状态码复核');
  await editor.getByRole('button', { name: '3 · 变更说明' }).click();
  await editor.getByLabel('本次修改原因', { exact: true }).fill('复制后保留为独立复核起点');
  await editor.getByRole('button', { name: '保存并评审用例', exact: true }).click();
  await expect(editor).not.toBeVisible();
  const run: WorkflowRun = await page.evaluate(
    () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs[0],
  );
  expect(run.approvals).toHaveLength(2);
  expect(run.status).toBe('awaiting_review');
  expect(Object.values(run.artifacts).some((item) => item.type === 'TestDesign')).toBe(true);
  expect(Object.values(run.artifacts).some((item) => item.type === 'TestCaseSet')).toBe(false);
  expect(run.artifacts['history.cases.2']).toBeDefined();
  await page.screenshot({ path: '.runtime/cases-manually-revised.png' });
  await page.getByRole('button', { name: '返回对话', exact: true }).click();
  await page
    .locator('.session-messages')
    .getByRole('button', { name: '查看修订前用例与结果' })
    .first()
    .click();
  await expect(page.locator('.design-revision-viewer')).toContainText('只读快照');
  await expect(page.locator('.design-revision-viewer').getByRole('button', { name: '新增用例' })).toHaveCount(
    0,
  );
});

test('retains case drafts across closing, session changes and the global unsaved-edit review', async ({
  page,
}) => {
  await page.getByRole('button', { name: '编辑用例', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '补充测试用例' });
  await editor.getByLabel('用例名称', { exact: true }).fill('未保存的用例细化');
  await editor.getByRole('button', { name: '保留草稿并关闭' }).click();
  await page.getByRole('button', { name: '新建会话', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '数据管理', exact: true }).click();
  await page.getByRole('button', { name: '查看未保存修改', exact: true }).click();
  const pending = page.getByRole('alertdialog');
  await expect(pending).toContainText('补充测试用例');
  await pending.getByRole('button', { name: '返回此条目' }).click();
  await expect(editor.getByLabel('用例名称', { exact: true })).toHaveValue('未保存的用例细化');
  await editor.getByRole('button', { name: '放弃修改', exact: true }).click();
  await expect(editor.getByLabel('用例名称', { exact: true })).not.toHaveValue('未保存的用例细化');
  await editor.getByRole('button', { name: '保留草稿并关闭' }).click();
});

test('adds a case with explicit scenario links and selects the saved item', async ({ page }) => {
  await page.getByRole('button', { name: '新增用例', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '补充测试用例' });
  await editor.getByLabel('ID', { exact: true }).fill('TC_HUMAN_NEW');
  await editor.getByLabel('用例名称', { exact: true }).fill('容量 8 的状态码独立复核');
  await editor.getByRole('checkbox', { name: /^S2 ·/ }).check();
  await editor.getByRole('button', { name: '2 · 步骤与断言' }).click();
  await editor.getByLabel('前置条件（每行一项，可留空）', { exact: true }).fill('框架恢复独立初始状态');
  await editor
    .getByLabel('测试步骤（每行一步）', { exact: true })
    .fill('以 player-a 提交 maxPlayers=8、mode=duel、ranked=false 的房间创建请求');
  await editor.getByLabel('可观察的预期结果', { exact: true }).fill('response.status 返回 201');
  await editor.getByLabel('具体断言（每行一项）', { exact: true }).fill('response.status == 201');
  await editor.getByRole('button', { name: '3 · 变更说明' }).click();
  await editor.getByLabel('本次修改原因', { exact: true }).fill('人工确认并补充可观察断言');
  await editor.getByRole('button', { name: '保存并评审用例', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(page.locator('.assets-detail')).toContainText('TC_HUMAN_NEW');
  await expect(page.locator('.assets-detail')).toContainText('容量 8 的状态码独立复核');
});

test('deleting a conversation explicitly removes its unsaved case drafts', async ({ page }) => {
  await page.getByRole('button', { name: '编辑用例', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '补充测试用例' });
  await editor.getByLabel('用例名称', { exact: true }).fill('随会话删除的草稿');
  await editor.getByRole('button', { name: '保留草稿并关闭' }).click();
  await page.locator('.session-history-row').first().getByRole('button', { name: '会话操作' }).click();
  await page.getByRole('button', { name: '删除会话', exact: true }).filter({ visible: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认删除', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '数据管理', exact: true }).click();
  await expect(page.getByRole('button', { name: '查看未保存修改', exact: true })).toHaveCount(0);
});
