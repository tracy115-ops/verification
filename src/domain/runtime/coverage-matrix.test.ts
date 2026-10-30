import { expect, it } from 'vitest';
import { coverageMatrix } from './coverage-matrix';
import { fixtureRun, requirements, design, cases } from './fixtures.test-support';
import { canonical } from '../team/collaboration';

it('keeps declarations separate from mapped scripts and passing evidence', () => {
  const run = fixtureRun();
  run.artifacts = {
    requirements: { type: 'RequirementBaseline', value: requirements, digest: 'r' },
    design: { type: 'TestDesign', value: design, digest: 'd' },
    cases: { type: 'TestCaseSet', value: cases, digest: 'c' },
    'coverage.declarations': {
      type: 'CoverageDeclarations',
      digest: 'claim',
      value: {
        version: 1,
        events: [
          {
            caseId: cases.cases[0].id,
            baseline: canonical(cases.cases[0]),
            covered: true,
            note: 'manual',
            at: new Date().toISOString(),
          },
        ],
      },
    },
  };
  const [row] = coverageMatrix(run);
  expect(row.cases).toHaveLength(1);
  expect(row.declared).toBe(1);
  expect(row.mapped).toBe(0);
  expect(row.passed).toBe(0);
  expect(row.gap).toBe(true);
  run.artifacts.design.value = { ...design, scenarios: [], factors: [] };
  expect(coverageMatrix(run)[0].scenarios).toHaveLength(0);
});
