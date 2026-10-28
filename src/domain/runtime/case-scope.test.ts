import { expect, it } from 'vitest';
import { advanceRun, approveRun } from './engine';
import { excludeCases } from './case-scope';
import { excludeReviewIssues } from './clarifications';
import { reviewIssues } from './handlers';
import { cases, design, fixturePort, fixtureRun, requirements } from './fixtures.test-support';
import type { AgentPort } from './types';

it('preserves the draft, invalidates approval and exposes gaps after excluding an unexecutable case', async () => {
  const expandedDesign = {
    ...design,
    scenarios: [...design.scenarios, { ...design.scenarios[0], id: 'SC-2' }],
  };
  const expandedCases = { cases: [...cases.cases, { ...cases.cases[0], id: 'TC-2', scenarioIds: ['SC-2'] }] };
  const port: AgentPort = {
    async send(request, event, signal) {
      const operation = JSON.parse(request.prompt).operation;
      return fixturePort(
        operation === 'requirements.extract'
          ? requirements
          : operation === 'scenarios.design'
            ? expandedDesign
            : expandedCases,
      ).port.send(request, event, signal);
    },
    async cancel() {},
  };
  let run = fixtureRun();
  for (let gate = 0; gate < 3; gate++) {
    run = await advanceRun(
      run,
      port,
      new AbortController().signal,
      () => {},
      () => {},
    );
    if (gate < 2) {
      const node = run.plan.find((item) => run.steps[item.id].status === 'awaiting_review')!;
      run = await approveRun(run, node.id, run.steps[node.id].reviewDigest!);
    }
  }
  const node = run.plan.find((item) => item.operation === 'review.cases')!;
  const originalDigest = run.steps[node.id].reviewDigest!;
  await expect(excludeCases(run, node.id, originalDigest, ['TC-1', 'TC-2'], 'No oracle')).rejects.toThrow(
    'approval_invalid',
  );
  await expect(excludeCases(run, node.id, originalDigest, ['unknown'], 'No oracle')).rejects.toThrow(
    'approval_invalid',
  );
  run = await excludeCases(run, node.id, originalDigest, ['TC-2'], 'No observable rejection contract');
  expect(reviewIssues(run, node)).toContain('SC-2');
  await expect(approveRun(run, node.id, originalDigest)).rejects.toThrow('approval_stale');
  await expect(approveRun(run, node.id, run.steps[node.id].reviewDigest!)).rejects.toThrow(
    'review_unresolved',
  );
  run = await excludeReviewIssues(run, node.id, run.steps[node.id].reviewDigest!, {
    'SC-2': 'No observable rejection contract',
  });
  run = await approveRun(run, node.id, run.steps[node.id].reviewDigest!);
  expect(run.artifacts['generate_cases.cases'].value).toEqual(expandedCases);
  expect(run.artifacts['review_cases.cases'].value).toEqual(cases);
  expect(run.reviewExclusions?.map((item) => item.issue)).toEqual(['case:TC-2', 'SC-2']);
});
