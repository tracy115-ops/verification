import { expect, it } from 'vitest';
import { designQuality } from './design-quality';
import { fixtureRun, requirements, design, cases } from './fixtures.test-support';
import { reviewIssues } from './handlers';

it('reports exact unused levels, missing cases and questions without claiming semantic coverage', () => {
  const run = fixtureRun();
  expect(designQuality(run)).toMatchObject({ findings: [], scenarios: 0, casesGenerated: false });
  run.artifacts = {
    requirements: {
      type: 'RequirementBaseline',
      digest: 'r',
      value: { ...requirements, questions: ['How is unlocking defined?'] },
    },
    design: {
      type: 'TestDesignDraft',
      digest: 'd',
      value: {
        ...design,
        factors: [{ ...design.factors[0], levels: ['4', '5', '6'] }],
        gaps: ['No recovery oracle'],
      },
    },
  };
  const result = designQuality(run);
  expect(result).toMatchObject({ levels: 3, coveredLevels: 1, scenarios: 1, coveredScenarios: 0 });
  expect(result.findings.map((item) => item.kind)).toEqual(['question', 'level', 'level', 'scenario', 'gap']);
  run.artifacts.cases = { type: 'TestCaseSet', digest: 'c', value: cases };
  expect(designQuality(run).coveredScenarios).toBe(1);
  expect(designQuality(run).findings.some((item) => item.kind === 'scenario')).toBe(false);
});

it('uses confirmed artifacts before drafts, and never treats textual similarity as a factor mapping', () => {
  const run = fixtureRun();
  run.artifacts = {
    draft: { type: 'TestDesignDraft', digest: 'draft', value: design },
    confirmed: {
      type: 'TestDesign',
      digest: 'confirmed',
      value: { ...design, scenarios: [{ ...design.scenarios[0], factorLevels: [] }] },
    },
  };
  expect(designQuality(run).coveredLevels).toBe(0);
  expect(designQuality(run).findings[0]).toMatchObject({ kind: 'level', id: 'F-1' });
});

it('separates pending generation from open gaps, and records answers/exclusions without increasing coverage', () => {
  const run = fixtureRun();
  const question = 'How is unlocking defined?';
  const requirementReview = run.plan.find((node) => node.operation === 'review.requirements')!;
  const coverageReview = run.plan.find((node) => node.operation === 'review.coverage')!;
  const producer = run.plan.find((node) => node.operation === 'scenarios.design')!;
  run.artifacts[`${requirementReview.id}.${Object.keys(requirementReview.outputs)[0]}`] = {
    type: 'RequirementBaseline',
    digest: 'r',
    value: { ...requirements, questions: [question] },
  };
  run.artifacts[`${producer.id}.${Object.keys(producer.outputs)[0]}`] = {
    type: 'TestDesignDraft',
    digest: 'd',
    value: { ...design, factors: [{ ...design.factors[0], levels: ['4', '5'] }] },
  };
  expect(reviewIssues(run, coverageReview)).toEqual(['F-1: 4']);
  expect(designQuality(run)).toMatchObject({
    open: 2,
    pending: 1,
    decided: 0,
    coveredLevels: 1,
    coveredScenarios: 0,
  });
  run.clarifications = [
    { question, answer: 'An administrator unlocks the account.', recordedAt: new Date().toISOString() },
  ];
  run.reviewExclusions = [
    {
      nodeId: coverageReview.id,
      issue: 'F-1: 4',
      reason: 'Deferred to a separate boundary campaign.',
      recordedAt: new Date().toISOString(),
    },
  ];
  const quality = designQuality(run);
  expect(quality).toMatchObject({ open: 0, pending: 1, decided: 2, coveredLevels: 1, coveredScenarios: 0 });
  expect(quality.findings.find((item) => item.kind === 'question')).toMatchObject({
    state: 'answered',
    reason: run.clarifications[0].answer,
  });
  expect(quality.findings.find((item) => item.kind === 'level')).toMatchObject({
    state: 'excluded',
    reason: run.reviewExclusions[0].reason,
  });
  expect(reviewIssues(run, coverageReview)).toEqual([]);
  run.reviewExclusions[0].nodeId = requirementReview.id;
  expect(designQuality(run).open).toBe(1);
});

it('checks direct requirement links and omits excluded cases when measuring scenario coverage', () => {
  const run = fixtureRun();
  const caseReview = run.plan.find((node) => node.operation === 'review.cases')!;
  run.artifacts = {
    requirements: {
      type: 'RequirementBaseline',
      digest: 'r',
      value: {
        ...requirements,
        requirements: [...requirements.requirements, { ...requirements.requirements[0], id: 'REQ-2' }],
      },
    },
    design: {
      type: 'TestDesign',
      digest: 'd',
      value: {
        ...design,
        scenarios: [design.scenarios[0], { ...design.scenarios[0], id: 'SC-2', requirementIds: ['REQ-2'] }],
      },
    },
    cases: {
      type: 'TestCaseSetDraft',
      digest: 'c',
      value: {
        cases: [
          cases.cases[0],
          { ...cases.cases[0], id: 'TC-2', scenarioIds: ['SC-2'], requirementIds: ['REQ-2'] },
        ],
      },
    },
  };
  expect(designQuality(run).open).toBe(0);
  run.reviewExclusions = [
    {
      nodeId: caseReview.id,
      issue: 'case:TC-1',
      reason: 'Out of this execution scope.',
      recordedAt: new Date().toISOString(),
    },
  ];
  const result = designQuality(run);
  expect(result.coveredScenarios).toBe(1);
  expect(result.findings.map((item) => [item.kind, item.id, item.state])).toEqual([
    ['requirement-cases', 'REQ-1', 'open'],
    ['scenario', 'SC-1', 'open'],
  ]);
});
