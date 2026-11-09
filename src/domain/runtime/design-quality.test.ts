import { expect, it } from 'vitest';
import { designQuality } from './design-quality';
import { fixtureRun, requirements, design, cases } from './fixtures.test-support';

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
