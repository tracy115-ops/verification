import { afterEach, expect, it, vi } from 'vitest';
import { fixtureRun } from './fixtures.test-support';
import { remainingNodeSeconds } from './deadline';
import { retryRun } from './engine';
import { decodeConversations } from '../../services/conversation-repository';

afterEach(() => vi.useRealTimers());
it('honors longer node timeouts and the remaining workflow budget', () => {
  vi.useFakeTimers();
  const run = fixtureRun();
  const node = run.plan.find((item) => item.operation === 'requirements.extract')!;
  node.policy.timeoutSeconds = 1800;
  expect(remainingNodeSeconds(run, node)).toBe(1800);
  run.snapshot.definition.limits.deadlineSeconds = 900;
  expect(remainingNodeSeconds(run, node)).toBe(900);
  vi.advanceTimersByTime(901000);
  expect(() => remainingNodeSeconds(run, node)).toThrow('run_deadline');
});

it('renews an expired run on manual retry and persists the resume time', () => {
  vi.useFakeTimers();
  const run = fixtureRun();
  run.status = 'failed';
  run.errorCode = 'run_deadline';
  vi.advanceTimersByTime((run.snapshot.definition.limits.deadlineSeconds + 1) * 1000);
  const retried = retryRun(run);
  expect(retried.id).toBe(run.id);
  expect(remainingNodeSeconds(retried, retried.plan[0])).toBe(retried.plan[0].policy.timeoutSeconds);
  const sessions = [
    { id: run.sessionId, title: 'retry', profileId: 'codex-native', messages: [], runs: [retried] },
  ];
  expect(decodeConversations(sessions)[0].runs[0].resumedAt).toBe(retried.resumedAt);
  expect(() =>
    decodeConversations([{ ...sessions[0], runs: [{ ...retried, resumedAt: 'bad-date' }] }]),
  ).toThrow('session_storage_invalid');
});
