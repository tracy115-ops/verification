import { expect, test } from '@playwright/test';
import type { TeamProject } from '../../src/domain/team/types';

test('a separate Agent member submits by HTTP, cannot merge, and the browser reviews its suggestion', async ({
  page,
  request,
}) => {
  // A deterministic HTTP client represents an external CLI; no model is invoked here.
  const adminToken = 'offline-team-e2e-owner-token-000000000000000000000000';
  const headers = { Authorization: `Bearer ${adminToken}` };
  const createdMember = await request.post('/api/team/members', {
    headers,
    data: { name: 'API Agent', role: 'editor' },
  });
  expect(createdMember.ok()).toBe(true);
  const agent = await createdMember.json();
  const agentHeaders = { Authorization: `Bearer ${agent.token}` };
  const created = await request.post('/api/team/projects', {
    headers,
    data: {
      title: `Agent API ${Date.now()}`,
      mode: 'black_box',
      locale: 'zh-CN',
      topic: '容量为2时返回201。',
      interfaces: [{ id: 'IF1', name: '创建房间', contract: '容量为2时返回201。' }],
    },
  });
  expect(created.ok()).toBe(true);
  let project: TeamProject = await created.json();
  const endpoint = `/api/team/projects/${project.id}`;
  const latest = await request.get(endpoint, { headers: agentHeaders });
  expect(latest.ok()).toBe(true);
  project = await latest.json();
  const body = {
    revision: project.revision,
    command: {
      type: 'propose',
      proposal: {
        version: 1,
        baseRevision: project.revision,
        source: { kind: 'agent', name: 'HTTP fixture', runId: 'api-gap-1' },
        items: [
          {
            id: 'I1',
            kind: 'factor',
            action: 'add',
            reason: '补充边界',
            value: {
              id: 'F_AGENT',
              name: '接口提交的容量因子',
              levels: ['2'],
              basis: 'explicit',
              sourceQuote: '容量为2',
              rationale: '明确边界',
            },
          },
        ],
      },
    },
  };
  const submitted = await request.post(`${endpoint}/commands`, { headers: agentHeaders, data: body });
  expect(submitted.ok()).toBe(true);
  project = await submitted.json();
  expect(project.factors).toHaveLength(0);
  const proposal = project.collaboration!.contributions[0];
  expect(proposal.by).toBe(agent.id);
  const denied = await request.post(`${endpoint}/commands`, {
    headers: agentHeaders,
    data: {
      revision: project.revision,
      command: {
        type: 'resolve_proposal',
        proposalId: proposal.id,
        itemId: 'I1',
        decision: 'accepted',
        comment: 'Not allowed',
      },
    },
  });
  expect(denied.status()).toBe(403);
  const stale = await request.post(`${endpoint}/commands`, { headers: agentHeaders, data: body });
  expect(stale.status()).toBe(409);
  await page.goto('/');
  await page.getByLabel('个人访问令牌', { exact: true }).fill(adminToken);
  await page.getByRole('button', { name: '进入工作台', exact: true }).click();
  await page.getByRole('button', { name: project.title, exact: true }).click();
  await page.getByRole('button', { name: /^补充建议/ }).click();
  await expect(page.locator('.collab-contributions')).toContainText('接口提交的容量因子');
  await page.getByRole('button', { name: 'Agent 接口接入', exact: true }).click();
  const guide = page.getByRole('textbox', { name: 'Agent 接口接入', exact: true });
  await expect(guide).toHaveValue(new RegExp(`${project.id}/commands`));
  expect(await guide.inputValue()).not.toContain(agent.token);
  expect(await guide.inputValue()).not.toContain(adminToken);
  await page.locator('dialog[open]').getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '合入此条', exact: true }).click();
  const merged: TeamProject = await (await request.get(endpoint, { headers: agentHeaders })).json();
  expect(merged.factors[0].id).toBe('F_AGENT');
  expect(merged.collaboration!.contributions[0].items[0].status).toBe('accepted');
});
