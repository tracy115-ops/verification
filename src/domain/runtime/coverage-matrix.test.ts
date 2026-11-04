import { expect, it } from 'vitest';
import { coverageMatrix } from './coverage-matrix';
import { fixtureRun, requirements, design, cases } from './fixtures.test-support';
import { canonical } from '../team/collaboration';
import { fixturePlan, implementation, verificationPorts } from '../execution/fixtures.test-support';

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

it('separates indirect scenario links and does not require a standalone factor for every rule', async () => {
  const run = fixtureRun();
  const plan = await fixturePlan();
  run.artifacts = {
    requirements: {
      type: 'RequirementBaseline',
      value: {
        ...requirements,
        requirements: [...requirements.requirements, { ...requirements.requirements[0], id: 'REQ-2' }],
      },
      digest: 'r',
    },
    design: {
      type: 'TestDesign',
      value: {
        ...design,
        factors: [],
        scenarios: [{ ...design.scenarios[0], requirementIds: ['REQ-1', 'REQ-2'], factorLevels: [] }],
      },
      digest: 'd',
    },
    cases: { type: 'TestCaseSet', value: cases, digest: 'c' },
    implementation: { type: 'ImplementationBundle', value: implementation, digest: 'i' },
    plan: { type: 'ExecutionPlan', value: plan, digest: 'p' },
  };
  const [direct, indirect] = coverageMatrix(run);
  expect(direct).toMatchObject({ gap: false, mapped: 1, passed: 0, notRun: 1 });
  expect(direct.factors).toHaveLength(0);
  expect(indirect).toMatchObject({ gap: true, mapped: 0, passed: 0 });
  expect(indirect.cases).toHaveLength(0);
  expect(indirect.indirectCases).toHaveLength(1);
  for (const status of ['passed', 'failed', 'error', 'skipped'] as const) {
    run.artifacts.evidence = {
      type: 'EvidenceBundle',
      value: await verificationPorts(status).execution.execute(
        plan,
        plan.digest,
        new AbortController().signal,
      ),
      digest: 'e',
    };
    const [row, unrelated] = coverageMatrix(run);
    expect(row.passed).toBe(status === 'passed' ? 1 : 0);
    expect(row.failed).toBe(status === 'failed' || status === 'error' ? 1 : 0);
    expect(row.skipped).toBe(status === 'skipped' ? 1 : 0);
    expect(unrelated.passed).toBe(0);
  }
});
