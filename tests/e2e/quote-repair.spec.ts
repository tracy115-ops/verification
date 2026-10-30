import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { RequirementArtifact, WorkflowRun } from '../../src/domain/runtime/types';

test('recovers an older failed CLI result and repairs its quote without another model call', async ({
  page,
}) => {
  // Recorded task adapted into an older quote-validation failure; no model call.
  const run = JSON.parse(
    readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
  ) as WorkflowRun;
  const baseline = Object.values(run.artifacts).find((item) => item.type === 'RequirementBaseline')!
    .value as RequirementArtifact;
  const spec = baseline.requirements[0].quote;
  const generated = {
    ...baseline,
    requirements: baseline.requirements.map((item, index) =>
      index === 0 ? { ...item, quote: '不存在的引用' } : item,
    ),
  };
  const node = run.plan.find((item) => item.operation === 'requirements.extract')!;
  const importNode = run.plan.find((item) => item.operation === 'documents.import')!;
  const importKey = `${importNode.id}.${Object.keys(importNode.outputs)[0]}`;
  run.artifacts = { [importKey]: run.artifacts[importKey] };
  run.createdAt = new Date().toISOString();
  run.status = 'failed';
  run.errorCode = 'source_quote_invalid';
  run.approvals = [];
  run.steps = Object.fromEntries(
    run.plan.map((item) => [
      item.id,
      {
        status: item.id === importNode.id ? 'succeeded' : item.id === node.id ? 'failed' : 'pending',
        attempts: item.id === node.id ? 1 : 0,
      },
    ]),
  );
  run.steps[node.id].turnId = crypto.randomUUID();
  run.steps[node.id].errorCode = 'source_quote_invalid';
  const record = {
    version: 1,
    id: run.steps[node.id].turnId!,
    sessionId: run.sessionId,
    runId: run.id,
    nodeId: node.id,
    operation: node.operation,
    request: {
      turnId: run.steps[node.id].turnId!,
      sessionId: run.sessionId,
      driver: 'codex',
      model: 'fixture-model',
      prompt: 'fixture',
      timeoutSeconds: 1800,
    },
    startedAt: run.createdAt,
    finishedAt: new Date().toISOString(),
    status: 'completed',
    text: JSON.stringify(generated),
    activities: [],
    validationError: 'source_quote_invalid',
  };
  await page.addInitScript(() =>
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: () => {
          throw new Error('No CLI call expected');
        },
      },
    }),
  );
  await page.goto('/');
  await page.evaluate(
    async ({ run, record }) => {
      localStorage.setItem(
        'verification-workbench.conversations.v1',
        JSON.stringify([
          { id: run.sessionId, title: '引用恢复测试', profileId: 'codex-native', messages: [], runs: [run] },
        ]),
      );
      await new Promise<void>((resolve, reject) => {
        const opening = indexedDB.open('verification-workbench-transcripts', 1);
        opening.onupgradeneeded = () =>
          opening.result.createObjectStore('turns', { keyPath: 'id' }).createIndex('session', 'sessionId');
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const db = opening.result,
            transaction = db.transaction('turns', 'readwrite');
          transaction.objectStore('turns').put(record);
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    },
    { run, record },
  );
  await page.reload();
  const repair = page.locator('.session-quote-repair');
  await expect(repair.getByRole('textbox')).toHaveValue('不存在的引用');
  await page.screenshot({ path: '.runtime/quote-repair.png' });
  await repair.getByRole('textbox').fill(spec);
  await repair.getByRole('button', { name: '保存引用并进入需求评审', exact: true }).click();
  await expect(repair).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs[0].status,
      ),
    )
    .toBe('awaiting_review');
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs[0],
  );
  expect(saved.id).toBe(run.id);
  expect(saved.status).toBe('awaiting_review');
  expect(saved.approvals).toHaveLength(0);
  await expect(page.getByText('引用已修复', { exact: true })).toBeVisible();
});
