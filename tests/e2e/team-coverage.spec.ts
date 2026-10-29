import { expect, test } from '@playwright/test';
const token = 'offline-team-e2e-owner-token-000000000000000000000000';

test('reviews an incremental suggestion, declares coverage, maps Python and invalidates changed cases', async ({
  page,
  browser,
  request,
}) => {
  const headers = { Authorization: `Bearer ${token}` };
  const me = await (await request.get('/api/team/me', { headers })).json();
  let project = await (
    await request.post('/api/team/projects', {
      headers,
      data: {
        title: `Coverage ${Date.now()}`,
        mode: 'black_box',
        locale: 'zh-CN',
        topic: '容量为2时返回201。',
        interfaces: [{ id: 'IF1', name: '创建房间', contract: '容量为2时返回201。' }],
      },
    })
  ).json();
  const command = async (command: unknown) => {
    const result = await request.post(`/api/team/projects/${project.id}/commands`, {
      headers,
      data: { revision: project.revision, command },
    });
    expect(result.ok()).toBe(true);
    project = await result.json();
  };
  await command({
    type: 'upsert_factor',
    factor: {
      id: 'F1',
      name: '容量',
      levels: ['2'],
      basis: 'explicit',
      sourceQuote: '容量为2',
      rationale: '合法容量',
    },
  });
  await command({ type: 'add_scenario', id: 'S1', title: '创建容量2的房间', interfaceIds: ['IF1'] });
  await command({
    type: 'edit_scenario',
    scenarioId: 'S1',
    title: '创建容量2的房间',
    oracle: 'HTTP201',
    oracleBasis: 'contract',
    sourceQuote: '容量为2时返回201。',
    factorValues: [{ factorId: 'F1', level: '2' }],
    ownerId: me.id,
  });
  await command({ type: 'review', scenarioId: 'S1', decision: 'accepted', comment: '明确契约' });
  await page.goto('/');
  await page.getByLabel('个人访问令牌', { exact: true }).fill(token);
  await page.getByRole('button', { name: '进入工作台', exact: true }).click();
  await page.getByRole('button', { name: project.title, exact: true }).click();
  await page.getByRole('button', { name: /^补充建议/ }).click();
  await page.getByRole('button', { name: '导入补充建议', exact: true }).click();
  const proposal = {
    version: 1,
    baseRevision: project.revision,
    source: { kind: 'agent', name: 'Offline UI fixture', runId: 'fixture-1' },
    items: [
      {
        id: 'I1',
        kind: 'case',
        action: 'add',
        reason: '补充独立的接口断言',
        value: {
          id: 'TC1',
          title: '容量2创建成功',
          scenarioIds: ['S1'],
          preconditions: ['独立初始状态'],
          steps: ['POST /rooms'],
          expected: 'HTTP201',
          assertions: ['status == 201'],
          ownerId: me.id,
        },
      },
    ],
  };
  const dialog = page.locator('.session-review-dialog[open]');
  await dialog.getByLabel('补充包 JSON', { exact: true }).fill(JSON.stringify(proposal));
  await dialog.getByRole('button', { name: '提交待评审建议', exact: true }).click();
  await expect(page.locator('.collab-detail')).toContainText('容量2创建成功');
  await page.getByRole('button', { name: '合入此条', exact: true }).click();
  await expect(page.locator('.collab-detail')).toContainText('已合入');
  await page.getByRole('button', { name: /^用例与脚本/ }).click();
  await page.getByRole('button', { name: '确认用例设计', exact: true }).click();
  await expect(page.locator('.collab-detail')).toContainText('设计已接受');
  await page.getByLabel('声明此用例已有脚本覆盖', { exact: true }).check();
  await page.getByLabel('脚本位置／方法及核对说明', { exact: true }).fill('test_rooms.py::test_capacity');
  await page.getByRole('button', { name: '保存覆盖声明', exact: true }).click();
  await expect(page.locator('.collab-list-item')).toContainText('已声明覆盖');
  await expect(page.locator('.collab-detail')).toContainText('未执行／无结果');
  await page.getByRole('button', { name: '关联 Python 脚本', exact: true }).click();
  const script =
    'import unittest\nclass Rooms(unittest.TestCase):\n    def test_capacity(self):\n        self.assertEqual(201, 201)\n';
  await dialog.getByLabel('Python 脚本原文', { exact: true }).fill(script);
  await dialog.getByRole('button', { name: '静态分析测试方法', exact: true }).click();
  await dialog.getByLabel('TC1 此用例对应的方法（可多选）', { exact: true }).selectOption('test_capacity');
  await dialog.getByRole('button', { name: '保存脚本与映射', exact: true }).click();
  await expect(page.locator('.collab-list-item')).toContainText('方法映射已核对');
  await expect(page.locator('.collab-detail')).toContainText('未执行／无结果');
  await page.screenshot({ path: '.runtime/team-case-coverage.png', fullPage: true });
  const reviewer = await (
    await request.post('/api/team/members', {
      headers,
      data: { name: 'Coverage reviewer', role: 'reviewer' },
    })
  ).json();
  const context = await browser.newContext();
  const colleague = await context.newPage();
  await colleague.goto('/');
  await colleague.getByLabel('个人访问令牌', { exact: true }).fill(reviewer.token);
  await colleague.getByRole('button', { name: '进入工作台', exact: true }).click();
  await colleague.getByRole('button', { name: project.title, exact: true }).click();
  await colleague.getByRole('button', { name: /^用例与脚本/ }).click();
  await expect(colleague.locator('.collab-list-item')).toContainText('方法映射已核对');
  await expect(colleague.getByRole('button', { name: '编辑用例', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '编辑用例', exact: true }).click();
  await dialog.getByLabel('可观察的预期结果', { exact: true }).fill('HTTP201，响应包含房间ID');
  await dialog.getByRole('button', { name: '保存用例草稿', exact: true }).click();
  await expect(page.locator('.collab-list-item')).toContainText('映射／声明已失效');
  await expect(colleague.locator('.collab-list-item')).toContainText('映射／声明已失效', { timeout: 10000 });
  await page.reload();
  await page.getByRole('button', { name: project.title, exact: true }).click();
  await page.getByRole('button', { name: /^用例与脚本/ }).click();
  await expect(page.locator('.collab-list-item')).toContainText('映射／声明已失效');
  await context.close();
});
