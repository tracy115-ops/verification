import { expect, it } from 'vitest';
import { verificationRun, verificationPorts } from '../execution/fixtures.test-support';
import { advanceRun, approveRun } from './engine';
import { cases } from './fixtures.test-support';
import { personalCoverage } from './case-coverage';
import { runScriptContribution } from '../team/run-contribution';
import { latestArtifact } from './bindings';
import type { EvidenceBundle, ExecutionPlan, ImplementationBundle } from '../execution/types';

async function executedRun() {
  const ports = verificationPorts('passed');
  let run = verificationRun();
  for (let index = 0; index < 6 && run.status !== 'completed'; index++) {
    run = await advanceRun(
      run,
      ports.agent,
      new AbortController().signal,
      () => {},
      () => {},
      ports.execution,
    );
    const review = run.plan.find((node) => run.steps[node.id].status === 'awaiting_review');
    if (review) run = await approveRun(run, review.id, run.steps[review.id].reviewDigest!);
  }
  expect(run.status).toBe('completed');
  return run;
}

it('retains verified coverage and exports execution for matching current artifacts', async () => {
  const run = await executedRun();
  expect(personalCoverage(run, cases.cases[0])).toMatchObject({ status: 'mapped', execution: 'passed' });
  expect(runScriptContribution(run)?.execution?.results).toEqual([
    { testName: 'test_probe', status: 'passed' },
  ]);
});

it('does not transfer a prior pass to a remapped case with identical script text', async () => {
  const run = await executedRun();
  const bundle = latestArtifact(run, 'ImplementationBundle') as ImplementationBundle;
  bundle.tests[0].caseIds = ['NEW_CASE'];
  expect(personalCoverage(run, { ...cases.cases[0], id: 'NEW_CASE' })).toMatchObject({
    status: 'declared',
    execution: 'not_run',
  });
  expect(runScriptContribution(run)).not.toHaveProperty('execution');
});

it.each(['execution', 'missing-result', 'duplicate-result'])(
  'retains method mapping but suppresses invalid %s evidence in coverage and exports',
  async (variant) => {
    const run = await executedRun();
    const evidence = latestArtifact(run, 'EvidenceBundle') as EvidenceBundle;
    if (variant === 'execution') evidence.executionId = crypto.randomUUID();
    if (variant === 'missing-result') evidence.results = [];
    if (variant === 'duplicate-result') evidence.results.push(structuredClone(evidence.results[0]));
    expect(personalCoverage(run, cases.cases[0])).toMatchObject({ status: 'mapped', execution: 'not_run' });
    expect(runScriptContribution(run)).not.toHaveProperty('execution');
  },
);

it.each(['run', 'session', 'methods'])('does not use a plan with mismatched %s identity', async (variant) => {
  const run = await executedRun();
  const plan = latestArtifact(run, 'ExecutionPlan') as ExecutionPlan;
  if (variant === 'run') plan.payload.runId = crypto.randomUUID();
  if (variant === 'session') plan.payload.sessionId = crypto.randomUUID();
  if (variant === 'methods') plan.testNames = ['test_other'];
  expect(personalCoverage(run, cases.cases[0])).toMatchObject({ status: 'declared', execution: 'not_run' });
  expect(runScriptContribution(run)).not.toHaveProperty('execution');
});

it('rejects a plan that repeats one method in place of another', async () => {
  const run = await executedRun();
  const bundle = latestArtifact(run, 'ImplementationBundle') as ImplementationBundle;
  const plan = latestArtifact(run, 'ExecutionPlan') as ExecutionPlan;
  bundle.tests.push({ testName: 'test_other', caseIds: ['OTHER_CASE'] });
  plan.payload.implementation = structuredClone(bundle);
  plan.testNames = ['test_probe', 'test_probe'];
  expect(personalCoverage(run, cases.cases[0])).toMatchObject({ status: 'declared', execution: 'not_run' });
});
