import { expect, it } from 'vitest';
import { advanceRun, approveRun } from './engine';
import { clarifyRequirements, excludeReviewIssues } from './clarifications';
import { fixturePort, fixtureRun, requirements } from './fixtures.test-support';
import { reviewIssues, taskFor } from './handlers';

it('records answers separately from source, invalidates the old approval and passes them to the next agent', async () => {
  const port = fixturePort({ ...requirements, questions: ['Which limit?'] }).port;
  let run = await advanceRun(
    fixtureRun(),
    port,
    new AbortController().signal,
    () => {},
    () => {},
  );
  const node = run.plan.find((item) => item.operation === 'review.requirements')!;
  const old = run.steps[node.id].reviewDigest!;
  const originalSpec = run.spec;
  await expect(approveRun(run, node.id, old)).rejects.toThrow('review_unresolved');
  run = await clarifyRequirements(run, node.id, old, { 'Which limit?': 'The limit is 5.' });
  expect(run.spec).toBe(originalSpec);
  expect(reviewIssues(run, node)).toEqual([]);
  await expect(approveRun(run, node.id, old)).rejects.toThrow('approval_stale');
  run = await approveRun(run, node.id, run.steps[node.id].reviewDigest!);
  const next = run.plan.find((item) => item.operation === 'scenarios.design')!;
  expect(JSON.parse(taskFor(run, next, {})).clarifications[0].answer).toBe('The limit is 5.');
});
it('records an unknown requirement as an exclusion rather than an invented answer', async () => {
  const port = fixturePort({ ...requirements, questions: ['Unknown rule?'] }).port;
  let run = await advanceRun(
    fixtureRun(),
    port,
    new AbortController().signal,
    () => {},
    () => {},
  );
  const node = run.plan.find((item) => item.operation === 'review.requirements')!;
  run = await excludeReviewIssues(run, node.id, run.steps[node.id].reviewDigest!, {
    'Unknown rule?': 'Outside this run.',
  });
  expect(run.clarifications).toBeUndefined();
  expect(run.reviewExclusions?.[0].reason).toBe('Outside this run.');
  expect(reviewIssues(run, node)).toEqual([]);
});

it('keeps an explicit coverage exclusion with its reason and binds it to approval', async () => {
  const port = fixturePort().port;
  let run = await advanceRun(
    fixtureRun(),
    port,
    new AbortController().signal,
    () => {},
    () => {},
  );
  const requirementsNode = run.plan.find((item) => item.operation === 'review.requirements')!;
  run = await approveRun(run, requirementsNode.id, run.steps[requirementsNode.id].reviewDigest!);
  const { design } = await import('./fixtures.test-support');
  run = await advanceRun(
    run,
    fixturePort({
      ...design,
      factors: [{ ...design.factors[0], levels: ['5', '4'] }],
      gaps: ['Unspecified rule'],
    }).port,
    new AbortController().signal,
    () => {},
    () => {},
  );
  const node = run.plan.find((item) => item.operation === 'review.coverage')!;
  const old = run.steps[node.id].reviewDigest!;
  expect(reviewIssues(run, node)).toContain('F-1: 4');
  await expect(approveRun(run, node.id, old)).rejects.toThrow('review_unresolved');
  run = await excludeReviewIssues(run, node.id, old, {
    'Unspecified rule': 'No oracle is documented.',
    'F-1: 4': 'Excluded in this iteration.',
  });
  expect(run.reviewExclusions?.[0].reason).toBe('No oracle is documented.');
  expect(reviewIssues(run, node)).toEqual([]);
  await expect(approveRun(run, node.id, old)).rejects.toThrow('approval_stale');
  await expect(approveRun(run, node.id, run.steps[node.id].reviewDigest!)).resolves.toMatchObject({
    status: 'ready',
  });
});
it('reports a requirement that is not covered even when its shared scenario has a case', async () => {
  const { design, cases } = await import('./fixtures.test-support');
  const run = fixtureRun();
  run.artifacts.requirements = {
    type: 'RequirementBaseline',
    digest: 'x',
    value: {
      ...requirements,
      requirements: [...requirements.requirements, { ...requirements.requirements[0], id: 'REQ-2' }],
    },
  };
  run.artifacts.design = {
    type: 'TestDesign',
    digest: 'x',
    value: { ...design, scenarios: [{ ...design.scenarios[0], requirementIds: ['REQ-1', 'REQ-2'] }] },
  };
  run.artifacts.cases = { type: 'TestCaseSetDraft', digest: 'x', value: cases };
  const node = run.plan.find((item) => item.operation === 'review.cases')!;
  expect(reviewIssues(run, node)).toEqual(['REQ-2']);
});
