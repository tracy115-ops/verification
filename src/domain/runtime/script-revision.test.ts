import { expect, it } from 'vitest';
import { verificationRun, implementation } from '../execution/fixtures.test-support';
import { digest } from './plan';
import { resolveScriptQuestions, implementationClarifications } from './script-revision';

it('archives identical rejected scripts separately, binds answers and caps revisions before any execution', async () => {
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
  for (let revision = 0; revision < 2; revision++) {
    run.status = 'failed';
    run.errorCode = 'review_unresolved';
    run.steps[preflight.id] = { status: 'failed', attempts: 1, errorCode: 'review_unresolved' };
    await expect(
      resolveScriptQuestions(run, 'stale', { 'Which response field?': 'body.score' }),
    ).rejects.toThrow('approval_stale');
    await expect(resolveScriptQuestions(run, hash, {})).rejects.toThrow('review_unresolved');
    run = await resolveScriptQuestions(run, hash, { 'Which response field?': 'body.score' });
    expect(run.status).toBe('ready');
    expect(run.steps[impl.id].status).toBe('pending');
  }
  expect(Object.values(run.artifacts).filter((item) => item.type === 'ImplementationRevision')).toHaveLength(
    2,
  );
  expect(implementationClarifications(run)).toEqual([
    { question: 'Which response field?', answer: 'body.score' },
  ]);
  run.status = 'failed';
  run.steps[preflight.id] = { status: 'failed', attempts: 1, errorCode: 'review_unresolved' };
  await expect(resolveScriptQuestions(run, hash, { 'Which response field?': 'body.score' })).rejects.toThrow(
    'retry_limit',
  );
  run.artifacts.executed = { type: 'EvidenceBundle', value: {}, digest: 'private' };
  await expect(resolveScriptQuestions(run, hash, { 'Which response field?': 'body.score' })).rejects.toThrow(
    'approval_invalid',
  );
});
