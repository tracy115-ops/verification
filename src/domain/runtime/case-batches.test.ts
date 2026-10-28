import { expect, it } from 'vitest';
import { advanceRun, approveRun, retryRun } from './engine';
import { fixtureRun, fixturePort, design, requirements, cases } from './fixtures.test-support';
import type { AgentPort } from './types';
import { saveConversations, loadConversations } from '../../services/conversation-repository';

it('retains completed batches across failure and reload, and retries only the failed batch', async () => {
  const scenarios = Array.from({ length: 7 }, (_, index) => ({
    ...design.scenarios[0],
    id: `SC-${index + 1}`,
  }));
  const calls: number[] = [];
  const failOnce = new Set([2, 3]);
  const port: AgentPort = {
    ...fixturePort().port,
    async send(request) {
      const task = JSON.parse(request.prompt);
      let value: unknown = requirements;
      if (task.operation === 'scenarios.design') value = { ...design, scenarios };
      if (task.operation === 'cases.generate') {
        calls.push(task.batch.index);
        if (failOnce.delete(task.batch.index)) {
          return { status: 'failed', text: '', errorCode: 'cli_timeout', nativeSessionId: null };
        }
        value = {
          cases: task.batch.allowedScenarioIds.map((id: string, index: number) => ({
            ...cases.cases[0],
            id: `TC-${index + 1}`,
            scenarioIds: [id],
          })),
        };
      }
      return { status: 'completed', text: JSON.stringify(value), errorCode: null, nativeSessionId: null };
    },
  };
  const advance = (run: ReturnType<typeof fixtureRun>) =>
    advanceRun(
      run,
      port,
      new AbortController().signal,
      () => {},
      () => {},
    );
  let run = fixtureRun();
  for (let gate = 0; gate < 2; gate++) {
    run = await advance(run);
    const node = run.plan.find((node) => run.steps[node.id].status === 'awaiting_review')!;
    run = await approveRun(run, node.id, run.steps[node.id].reviewDigest!);
  }
  run = await advance(run);
  expect(run.errorCode).toBe('cli_timeout');
  expect(calls).toEqual([1, 2]);
  const data = new Map<string, string>();
  saveConversations(
    {
      setItem: (key, value) => {
        data.set(key, value);
      },
    },
    [{ id: run.sessionId, title: 'test', profileId: 'codex-native', messages: [], runs: [run] }],
  );
  run = loadConversations({ getItem: (key) => data.get(key) ?? null })[0].runs[0];
  run = await advance(retryRun(run));
  expect(run.errorCode).toBe('cli_timeout');
  run = await advance(retryRun(run));
  expect(calls).toEqual([1, 2, 2, 3, 3]);
  expect(run.status).toBe('awaiting_review');
  const result = Object.values(run.artifacts).find((item) => item.type === 'TestCaseSetDraft')!
    .value as typeof cases;
  expect(result.cases.map((item) => item.id)).toEqual([
    'B1-TC-1',
    'B1-TC-2',
    'B1-TC-3',
    'B2-TC-1',
    'B2-TC-2',
    'B2-TC-3',
    'B3-TC-1',
  ]);
});
