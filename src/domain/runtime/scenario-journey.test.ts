import { expect, it } from 'vitest';
import { journeyFixture } from '../../../tests/fixtures/scenario-journey';
import { decodeDesign, isDesign } from './artifacts';
import { mergeDesigns, prefixDesign } from './analysis-merge';
import { fixtureRun } from './fixtures.test-support';
import { taskFor } from './handlers';
import { executionTask } from './execution';
import { designProposalTask } from './design-proposals';
import { reviseDesign } from './design-revision';
import { reportRunFixture } from '../../../tests/fixtures/report-run';
import { latestArtifact } from './bindings';
import type { RequirementArtifact, DesignArtifact } from './types';

it('accepts a source-linked rejection self-loop and preserves input immutability and legacy designs', () => {
  const { requirements, design } = journeyFixture();
  const before = structuredClone(design);
  expect(decodeDesign(design, requirements)).toEqual(design);
  expect(design).toEqual(before);
  delete design.scenarios[0].journey;
  expect(decodeDesign(design, requirements)).toEqual(design);
});

it('rejects disconnected paths, duplicate step IDs and unrelated requirements', () => {
  for (const change of ['initial', 'chain', 'duplicate', 'unrelated', 'blank'] as const) {
    const { requirements, design } = journeyFixture();
    const path = design.scenarios[0].journey!;
    if (change === 'initial') path.initialState = 'paid';
    if (change === 'chain') path.steps[1].fromState = 'no order';
    if (change === 'duplicate') path.steps[1].id = path.steps[0].id;
    if (change === 'unrelated') design.scenarios[0].requirementIds = ['R1'];
    if (change === 'blank') path.steps[1].observation = ' ';
    expect(() => decodeDesign(design, requirements), change).toThrow('journey_invalid');
  }
});

it('requires quotes from the exact step requirement and bounds schema version and size', () => {
  const { requirements, design } = journeyFixture();
  design.scenarios[0].journey!.steps[1].sourceQuote = requirements.requirements[0].quote;
  expect(() => decodeDesign(design, requirements)).toThrow('journey_quote_invalid');
  for (const value of [
    { ...journeyFixture().design.scenarios[0].journey!, version: 2 },
    { ...journeyFixture().design.scenarios[0].journey!, steps: [] },
    {
      ...journeyFixture().design.scenarios[0].journey!,
      steps: Array(13).fill(design.scenarios[0].journey!.steps[0]),
    },
  ])
    expect(isDesign({ ...design, scenarios: [{ ...design.scenarios[0], journey: value }] })).toBe(false);
});

it('retains distinct paths when merging analysis batches and prefixes only scenario scope', () => {
  const { requirements, design } = journeyFixture();
  const other = structuredClone(design);
  other.scenarios[0].journey!.steps[1].action += '; record returned status';
  const merged = mergeDesigns([prefixDesign(design, 0), prefixDesign(other, 1)]);
  expect(merged.scenarios).toHaveLength(2);
  expect(merged.scenarios[0].journey!.steps[0].id).toBe('T1');
  expect(decodeDesign(merged, requirements).scenarios).toHaveLength(2);
});

it('passes approved paths and bounded guidance to design, cases, proposals and implementation tasks', () => {
  const run = fixtureRun();
  const { requirements, design } = journeyFixture();
  run.spec = journeyFixture().spec;
  run.artifacts.baseline = { type: 'RequirementBaseline', value: requirements, digest: 'baseline' };
  run.artifacts.design = { type: 'TestDesign', value: design, digest: 'design' };
  for (const operation of ['scenarios.design', 'cases.generate']) {
    const node = run.plan.find((item) => item.operation === operation)!;
    const task = JSON.parse(taskFor(run, node, { design }));
    expect(task.deepTestingGuidance.journey).toContain('fromState');
    expect(task.inputs.design.scenarios[0].journey).toEqual(design.scenarios[0].journey);
    if (operation === 'scenarios.design') {
      expect(task.deepTestingGuidance.methods.map((method: { id: string }) => method.id)).toContain(
        'transition-sequence',
      );
      expect(task.deepTestingGuidance).not.toHaveProperty('implementation');
      expect(task.deepTestingGuidance).not.toHaveProperty('cases');
    }
  }
  expect(JSON.parse(designProposalTask(run, 'Keep the recovery path')).journeyInstruction).toContain(
    'sourceQuote',
  );
  const node = run.snapshot.definition.nodes.find((item) => item.operation === 'tests.implement')!;
  expect(JSON.parse(executionTask(run, node, { design })).deepTestingGuidance.journey).toContain(
    'approved action order',
  );
});

it('archives old execution and approvals when a human adds a path', async () => {
  const run = reportRunFixture();
  const baseline = latestArtifact(run, 'RequirementBaseline') as RequirementArtifact;
  const design = structuredClone(latestArtifact(run, 'TestDesign')) as DesignArtifact;
  const scenario = design.scenarios[0];
  const requirement = baseline.requirements.find((item) => scenario.requirementIds.includes(item.id))!;
  // This contract test uses opaque labels; it does not assert a new business rule.
  scenario.journey = {
    version: 1,
    initialState: 'initial',
    preconditions: [],
    steps: ['T1', 'T2'].map((id) => ({
      id,
      fromState: 'initial',
      toState: 'initial',
      action: 'Review source-backed operation',
      observation: 'Review declared result',
      requirementId: requirement.id,
      sourceQuote: requirement.quote,
    })),
  };
  const next = await reviseDesign(run, design, 'Add reviewed state path');
  expect(next.status).toBe('awaiting_review');
  expect(latestArtifact(next, 'TestDesignDraft')).toEqual(design);
  expect(latestArtifact(next, 'EvidenceBundle')).toBeUndefined();
  expect(latestArtifact(run, 'EvidenceBundle')).toBeDefined();
});
