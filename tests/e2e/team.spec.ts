import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
const ownerToken = 'offline-team-e2e-owner-token-000000000000000000000000';
async function login(page: Page, token = ownerToken) {
  await page.goto('/');
  await page.getByRole('button', { name: '项目协作', exact: true }).click();
  await page.getByLabel('个人访问令牌', { exact: true }).fill(token);
  await page.getByRole('button', { name: '进入工作台', exact: true }).click();
  await expect(page.getByRole('heading', { name: '选择共享项目', exact: true })).toBeVisible();
  await expect(page.locator('.team-connect-steps')).toBeVisible();
  await expect(page.locator('.team-workspace select')).toHaveCount(0);
}
test('creates a black-box topic, edits factors and shares assignments and reviews across browsers', async ({
  page,
  browser,
  request,
}) => {
  const name = `黑盒接口题 ${Date.now()}`;
  await page.addInitScript(() => Object.defineProperty(window.crypto, 'randomUUID', { value: undefined }));
  const auth = { Authorization: `Bearer ${ownerToken}` };
  const reviewer = await (
    await request.post('/api/team/members', { headers: auth, data: { name: '评审同事', role: 'reviewer' } })
  ).json();
  await login(page);
  await page.getByRole('button', { name: '新建测试项目', exact: true }).click();
  await page.getByLabel('项目名称', { exact: true }).fill(name);
  await page
    .getByLabel('题目／测试目标', { exact: true })
    .fill('账户登录连续失败5次后锁定；只有题目与外部接口。');
  await page.getByLabel('外部接口名称', { exact: true }).fill('登录接口');
  await page.getByLabel('接口描述／契约', { exact: true }).fill('登录失败5次后账户锁定。');
  await page.getByRole('button', { name: '创建共享项目', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.locator('.team-connect-steps')).toHaveCount(0);
  await expect(
    page.getByRole('navigation', { name: '项目工作步骤', exact: true }).getByRole('button'),
  ).toHaveCount(5);
  await page.getByRole('button', { name: '生成待评审建议', exact: true }).click();
  await expect(page.locator('.team-scenario-item')).toHaveCount(6);
  await expect(page.getByRole('button', { name: '接受场景设计', exact: true })).toBeDisabled();
  await page.getByRole('combobox', { name: '负责人', exact: true }).selectOption({ label: 'Owner' });
  await page
    .getByRole('textbox', { name: '可观察预期与判定依据', exact: true })
    .fill('第五次登录失败后，下一次登录被拒绝。');
  await page.getByRole('combobox', { name: '预期来源', exact: true }).selectOption('contract');
  await page.getByLabel('原文引用', { exact: true }).fill('登录失败5次后账户锁定。');
  await expect(page.getByRole('button', { name: '测试因子', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '更换项目', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '保存场景与分工', exact: true }).click();
  await expect(page.getByRole('button', { name: '接受场景设计', exact: true })).toBeEnabled();
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const colleague = await context.newPage();
  await login(colleague, reviewer.token);
  await colleague.getByRole('button', { name, exact: true }).click();
  await expect(colleague.getByRole('textbox', { name: '可观察预期与判定依据', exact: true })).toHaveValue(
    '第五次登录失败后，下一次登录被拒绝。',
  );
  await expect(colleague.getByRole('button', { name: '保存场景与分工', exact: true })).toHaveCount(0);
  await colleague.getByLabel('评审意见／讨论', { exact: true }).fill('依据题目接受设计；仍未执行测试。');
  await colleague.getByRole('button', { name: '接受场景设计', exact: true }).click();
  await expect(colleague.locator('.team-scenario-item').first()).toContainText('设计已接受');
  await expect(page.locator('.team-scenario-item').first()).toContainText('设计已接受', { timeout: 10000 });
  await page.locator('.app-content').evaluate((element) => (element.scrollTop = 0));
  await page.screenshot({ path: '.runtime/team-blackbox-light.png', fullPage: true });
  await page.getByRole('button', { name: '测试因子', exact: true }).click();
  await page.getByRole('button', { name: '编辑因子', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: '编辑因子', exact: true })).toBeVisible();
  await expect(page.locator('.team-factor-list > .team-factor-form')).toHaveCount(0);
  await page.getByLabel('因子名称', { exact: true }).fill('登录输入有效性与边界');
  await page.getByRole('button', { name: '保存因子', exact: true }).click();
  await page.getByRole('button', { name: '场景评审', exact: true }).click();
  await expect(page.locator('.team-scenario-item').first()).toContainText('待评审');
  await expect(colleague.locator('.team-scenario-item').first()).toContainText('待评审', { timeout: 10000 });
  await page.reload();
  await page.getByRole('button', { name: '项目协作', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('button', { name: '测试因子', exact: true }).click();
  await expect(page.locator('.team-factor-list')).toContainText('登录输入有效性与边界');
  await page.getByRole('button', { name: '需求', exact: true }).click();
  await expect(page.locator('.team-questions')).not.toHaveAttribute('open');
  await page.getByRole('button', { name: '场景评审', exact: true }).click();
  await page.getByRole('button', { name: '添加候选场景', exact: true }).click();
  const scenarioDialog = page.getByRole('dialog', { name: '添加候选场景', exact: true });
  await scenarioDialog.getByLabel('场景名称', { exact: true }).fill('人工补充的并发登录场景');
  await scenarioDialog.getByLabel('外部接口名称', { exact: true }).selectOption({ label: '登录接口' });
  await scenarioDialog.getByRole('button', { name: '添加候选场景', exact: true }).click();
  await expect(scenarioDialog).not.toBeVisible();
  await expect(page.locator('.team-scenario-item')).toHaveCount(7);
  await context.close();
});
test('retains a local draft when another member changes the shared revision', async ({ page, request }) => {
  const auth = { Authorization: `Bearer ${ownerToken}` };
  let project = await (
    await request.post('/api/team/projects', {
      headers: auth,
      data: {
        title: `冲突检查 ${Date.now()}`,
        mode: 'collaborative',
        locale: 'zh-CN',
        topic: '多人共同分析外部接口',
        interfaces: [],
      },
    })
  ).json();
  project = await (
    await request.post(`/api/team/projects/${project.id}/commands`, {
      headers: auth,
      data: { revision: project.revision, command: { type: 'suggest' } },
    })
  ).json();
  await login(page);
  await page.getByRole('button', { name: project.title, exact: true }).click();
  await page.getByRole('textbox', { name: '可观察预期与判定依据', exact: true }).fill('我的本地修改必须保留');
  await request.post(`/api/team/projects/${project.id}/commands`, {
    headers: auth,
    data: {
      revision: project.revision,
      command: { type: 'comment', scenarioId: project.scenarios[0].id, text: '另一位同事更新' },
    },
  });
  await page.getByRole('button', { name: '保存场景与分工', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('共享版本已变化');
  await expect(page.getByRole('textbox', { name: '可观察预期与判定依据', exact: true })).toHaveValue(
    '我的本地修改必须保留',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 900, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
