import { afterEach, expect, it, vi } from 'vitest';
import { verificationRun, implementation } from '../execution/fixtures.test-support';
import { digest } from './plan';
import { resolveScriptQuestions, implementationClarifications } from './script-revision';
import { remainingNodeSeconds } from './deadline';

afterEach(() => vi.useRealTimers());

it('archives repeated script clarifications without fixed retry caps and renews recovery budgets', async () => {
  vi.useFakeTimers();
  let run = verificationRun();
  const impl = run.plan.find((node) => node.operation === 'tests.implement')!;
  const preflight = run.plan.find((node) => node.operation === 'targets.preflight')!;
  const value = { ...implementation, questions: ['Which response field?'] };
  const hash = await digest(value);
  run.artifacts[`${impl.id}.${Object.keys(impl.outputs)[0]}`] = {
    type: 'ImplementationBundle',
    value,
    digest: hash,
  };
  for (let revision = 0; revision < 4; revision++) {
    run.status = 'failed';
    run.errorCode = 'review_unresolved';
    run.steps[preflight.id] = { status: 'failed', attempts: 1, errorCode: 'review_unresolved' };
    await expect(
      resolveScriptQuestions(run, 'stale', { 'Which response field?': 'body.score' }),
    ).rejects.toThrow('approval_stale');
    await expect(resolveScriptQuestions(run, hash, {})).rejects.toThrow('review_unresolved');
    vi.advanceTimersByTime(48 * 3600_000);
    run = await resolveScriptQuestions(run, hash, { 'Which response field?': 'body.score' });
    expect(run.status).toBe('ready');
    expect(run.steps[impl.id].status).toBe('pending');
    expect(remainingNodeSeconds(run, impl)).toBe(impl.policy.timeoutSeconds);
  }
  expect(Object.values(run.artifacts).filter((item) => item.type === 'ImplementationRevision')).toHaveLength(
    4,
  );
  expect(implementationClarifications(run)).toEqual([
    { question: 'Which response field?', answer: 'body.score' },
  ]);
  run.status = 'failed';
  run.steps[preflight.id] = { status: 'failed', attempts: 1, errorCode: 'review_unresolved' };
  run.artifacts.executed = { type: 'EvidenceBundle', value: {}, digest: 'private' };
  await expect(resolveScriptQuestions(run, hash, { 'Which response field?': 'body.score' })).rejects.toThrow(
    'approval_invalid',
  );
});
