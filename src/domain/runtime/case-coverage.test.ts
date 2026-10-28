import { expect, it } from 'vitest';
import { fixtureRun, cases, design, requirements } from './fixtures.test-support';
import { personalCoverage } from './case-coverage';
import { canonical } from '../team/collaboration';
import { runContribution, importRunContribution } from '../team/run-contribution';
import type { TeamProject } from '../team/types';

it('keeps manual declarations distinct from verified methods and invalidates changed cases', () => {
  const run = fixtureRun();
  const item = cases.cases[0];
  expect(personalCoverage(run, item)).toMatchObject({ status: 'uncovered', execution: 'not_run' });
  run.artifacts['coverage.declarations'] = {
    type: 'CaseCoverageDeclarations',
    digest: 'test',
    value: {
      version: 1,
      events: [
        {
          caseId: item.id,
          baseline: canonical(item),
          covered: true,
          note: 'tests.py::test_case',
          at: new Date().toISOString(),
        },
      ],
    },
  };
  expect(personalCoverage(run, item)).toMatchObject({ status: 'declared', execution: 'not_run' });
  expect(personalCoverage(run, { ...item, expected: 'Changed expectation' })).toMatchObject({
    status: 'stale',
    execution: 'not_run',
  });
});
it('exports a reviewed task as an additive package with unique IDs and no CLI profiles', () => {
  const run = fixtureRun();
  run.artifacts = {
    req: { type: 'RequirementBaseline', digest: 'test', value: requirements },
    design: { type: 'TestDesign', digest: 'test', value: design },
    cases: { type: 'TestCaseSet', digest: 'test', value: cases },
  };
  const bundle = runContribution(run)!;
  expect(bundle).not.toHaveProperty('profiles');
  expect(bundle).not.toHaveProperty('executionProfile');
  const project: TeamProject = {
    formatVersion: 1,
    id: 'P_test',
    title: 'Test',
    mode: 'black_box',
    locale: 'zh-CN',
    topic: run.spec,
    interfaces: [{ id: 'IF1', name: 'API', contract: run.spec }],
    revision: 4,
    updatedAt: new Date().toISOString(),
    updatedBy: 'M1',
    factors: [],
    scenarios: [],
    questions: [],
    comments: [],
  };
  const proposal = importRunContribution(bundle, project, ['IF1'], 'Source run');
  expect(proposal.baseRevision).toBe(4);
  expect(proposal.items.map((item) => item.kind)).toEqual(['factor', 'scenario', 'case']);
  expect(new Set(proposal.items.map((item) => item.id)).size).toBe(proposal.items.length);
  expect(() => importRunContribution({ kind: 'workflow-contribution' }, project, ['IF1'], 'Invalid')).toThrow(
    'team_invalid',
  );
});
