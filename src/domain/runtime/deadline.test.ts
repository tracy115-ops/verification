import { afterEach, expect, it, vi } from 'vitest';
import { fixtureRun } from './fixtures.test-support';
import { remainingNodeSeconds } from './deadline';

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
