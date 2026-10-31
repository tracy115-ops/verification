import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { WorkflowDefinition, WorkbenchDocument } from '../../src/domain/workflow';
import type { WorkflowRun } from '../../src/domain/runtime/types';
import { createSession, message } from '../../src/domain/runtime/chat';
import type { CliTurnRecord } from '../../src/domain/runtime/transcript';

test('shows recorded public replies and exact requests, restores them and deletes their storage', async ({
  page,
}) => {
  // Explicit offline fixture: this checks UI/persistence, not CLI inference.
  const session = createSession('codex-native');
  session.title = 'Recorded fixture';
  session.messages = [message('user', '账户连续失败5次后锁定。')];
  const definition = JSON.parse(
    readFileSync('docs/examples/general-testing.workflow.json', 'utf8'),
  ) as WorkflowDefinition;
  const profile = {
    id: 'codex-native',
    name: 'Fixture',
    driver: 'codex',
    protocol: 'native',
    baseUrl: '',
    model: 'fixture-model',
    credentialRef: '',
  } as const;
  const snapshot: WorkbenchDocument = {
    formatVersion: 1,
    revision: 1,
    definition,
    profiles: [profile],
    bindings: {},
    layout: {},
    nodeTitles: {},
  };
  const plan = definition.nodes.slice(0, 7);
  const run: WorkflowRun = {
    id: crypto.randomUUID(),
    sessionId: session.id,
    createdAt: new Date().toISOString(),
    scope: 'design',
    snapshot,
    plan,
    profiles: [profile],
    defaultProfileId: profile.id,
    spec: '账户连续失败5次后锁定。',
    status: 'failed',
    steps: Object.fromEntries(plan.map((node) => [node.id, { status: 'pending', attempts: 0 }])),
    artifacts: {},
    approvals: [],
  };
  run.sessionId = session.id;
  run.status = 'failed';
  run.errorCode = 'artifact_invalid';
  const node = run.plan.find((item) => item.operation === 'requirements.extract')!;
  run.steps[node.id] = {
    status: 'failed',
    attempts: 1,
    turnId: 'fixture-turn',
    errorCode: 'artifact_invalid',
  };
  session.runs = [run];
  const record: CliTurnRecord = {
    version: 1,
    id: 'fixture-turn',
    sessionId: session.id,
    runId: run.id,
    nodeId: node.id,
    operation: node.operation,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    status: 'completed',
    text: JSON.stringify({
      requirements: [{ id: 'R1', text: run.spec, quote: run.spec, acceptanceCriteria: ['第5次失败锁定'] }],
      questions: [],
    }),
    activities: [],
    validationError: 'artifact_invalid',
    request: {
      turnId: 'fixture-turn',
      sessionId: session.id,
      driver: 'codex',
      model: 'fixture-model',
      prompt: 'exact submitted fixture task',
      timeoutSeconds: 60,
    },
  };
  await page.goto('/');
  await page.evaluate(
    async ({ session, record }) => {
      localStorage.setItem('verification-workbench.conversations.v1', JSON.stringify([session]));
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('verification-workbench-transcripts', 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore('turns', { keyPath: 'id' }).createIndex('session', 'sessionId');
        request.onsuccess = () => resolve(request.result);
        request.onerror = reject;
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('turns', 'readwrite');
        transaction.objectStore('turns').put(record);
        transaction.oncomplete = () => resolve();
        transaction.onerror = reject;
      });
      db.close();
    },
    { session, record },
  );
  await page.reload();
  const card = page.locator('.session-cli-turn');
  await expect(card).toContainText('账户连续失败5次后锁定。');
  await expect(card).toContainText('产物校验未通过');
  const requestSummary = card.locator('.session-cli-request summary');
  await expect(requestSummary).toContainText('实际提交给 Agent 的任务');
  await expect(requestSummary).toContainText(
    `输入 ${new Intl.NumberFormat('zh-CN').format(Buffer.byteLength(record.request.prompt, 'utf8'))} 字节`,
  );
  await requestSummary.click();
  await expect(card.locator('pre').first()).toHaveText(record.request.prompt);
  await card.getByText('查看完整 CLI 回复', { exact: true }).click();
  await expect(card.locator('pre').last()).toHaveText(record.text);
  await page.reload();
  await expect(card).toContainText('账户连续失败5次后锁定。');
  await page.locator('.session-history-row').getByRole('button', { name: '会话操作' }).click();
  await page.getByRole('button', { name: '删除会话', exact: true }).filter({ visible: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve) => {
          const req = indexedDB.open('verification-workbench-transcripts', 1);
          req.onsuccess = () => resolve(req.result);
        });
        return new Promise<number>((resolve) => {
          const req = db.transaction('turns').objectStore('turns').count();
          req.onsuccess = () => {
            db.close();
            resolve(req.result);
          };
        });
      }),
    )
    .toBe(0);
});
