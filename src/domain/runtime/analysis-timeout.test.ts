import { expect, it } from 'vitest';
import { fixtureRun } from './fixtures.test-support';
import { retryRun } from './engine';
import { remainingNodeSeconds } from './deadline';

it('changes only the failed analysis runtime budget and respects the workflow deadline', () => {
  const run = fixtureRun();
  const node = run.plan.find((item) => item.operation === 'requirements.extract')!;
  run.status = 'failed';
  run.steps[node.id].status = 'failed';
  const snapshot = structuredClone(run.snapshot);
  const retried = retryRun(run, false, 1800);
  expect(retried.id).toBe(run.id);
  expect(retried.snapshot).toEqual(snapshot);
  expect(retried.plan).toEqual(run.plan);
  expect(remainingNodeSeconds(retried, node)).toBe(1800);
  retried.snapshot.definition.limits.deadlineSeconds = 30;
  expect(remainingNodeSeconds(retried, node)).toBeLessThanOrEqual(30);
  for (const value of [0, -1, 1.5, 86401, Infinity, NaN])
    expect(() => retryRun(run, false, value)).toThrow('invalid_run');
  const system = run.plan.find((item) => item.operation === 'documents.import')!;
  run.steps[node.id].status = 'pending';
  run.steps[system.id].status = 'failed';
  expect(() => retryRun(run, false, 1800)).toThrow('invalid_run');
});

it('rejects invalid batch budgets and budgets on unrelated nodes', () => {
  const run = fixtureRun();
  run.status = 'interrupted';
  const node = run.plan.find((item) => item.operation === 'scenarios.design')!;
  run.steps[node.id].status = 'interrupted';
  for (const value of [0, -1, 1.5, 65, Infinity, NaN])
    expect(() => retryRun(run, false, undefined, value)).toThrow('invalid_run');
  expect(retryRun(run, false, undefined, 4).steps[node.id].analysisBatchBudget).toBe(4);
  run.steps[node.id].status = 'pending';
  const other = run.plan.find((item) => item.operation === 'requirements.extract')!;
  run.steps[other.id].status = 'interrupted';
  expect(() => retryRun(run, false, undefined, 4)).toThrow('invalid_run');
});
