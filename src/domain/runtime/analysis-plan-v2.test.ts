import { expect, it } from 'vitest';
import { designGroups } from './analysis-plan';
import { analysisCheckpoint, saveAnalysisBatch } from './analysis-checkpoint';
import { fixtureRun, design } from './fixtures.test-support';
import type { RequirementArtifact } from './types';

it('bounds each cross request while retaining every original cross-group requirement pair', () => {
  const baseline: RequirementArtifact = {
    requirements: Array.from({ length: 18 }, (_, index) => ({
      id: `R${index}`,
      text: 'a'.repeat(700),
      quote: 'rule',
      acceptanceCriteria: ['check'],
    })),
    questions: [],
  };
  const legacy = designGroups(baseline, 1);
  const refined = designGroups(baseline, 2);
  const pairs = (plan: typeof legacy) =>
    new Set(
      plan
        .filter((item) => item.cross)
        .flatMap((item) =>
          item.left.flatMap((left) => item.right.map((right) => JSON.stringify([left, right]))),
        ),
    );
  expect(refined.length).toBeGreaterThan(legacy.length);
  expect(pairs(refined)).toEqual(pairs(legacy));
  expect(refined.filter((item) => !item.cross)).toEqual(legacy.filter((item) => !item.cross));
  expect(
    refined.filter((item) => item.cross).every((item) => item.left.length <= 4 && item.right.length <= 4),
  ).toBe(true);
});

it('refines a legacy checkpoint only after verifying source, signature and saved digests', async () => {
  const run = fixtureRun();
  const node = run.plan.find((node) => node.operation === 'scenarios.design')!;
  const profile = run.profiles[0];
  const previous = await analysisCheckpoint(run, node, profile, 'design', 3, 2, {});
  await saveAnalysisBatch(previous, 0, design);
  await saveAnalysisBatch(previous, 1, design);
  const original = structuredClone(previous);
  run.spec += ' changed';
  await expect(analysisCheckpoint(run, node, profile, 'design', 6, 2, {}, 2)).rejects.toThrow(
    'approval_stale',
  );
  run.spec = fixtureRun().spec;
  previous.completed[0].digest = '0'.repeat(64);
  await expect(analysisCheckpoint(run, node, profile, 'design', 6, 2, {}, 2)).rejects.toThrow(
    'artifact_invalid',
  );
  previous.completed = structuredClone(original.completed);
  const refined = await analysisCheckpoint(run, node, profile, 'design', 6, 2, {}, 2);
  expect(refined.planVersion).toBe(2);
  expect(refined.completed).toEqual(original.completed);
  expect(refined.signature).not.toBe(original.signature);
  expect(previous).toEqual(original);
  expect(await analysisCheckpoint(run, node, profile, 'design', 6, 2, {}, 2)).toEqual(refined);
});

it('keeps partially completed legacy cross reviews on their original plan', async () => {
  const run = fixtureRun();
  const node = run.plan.find((node) => node.operation === 'scenarios.design')!;
  const profile = run.profiles[0];
  const old = await analysisCheckpoint(run, node, profile, 'design', 3, 2, {});
  for (let index = 0; index < 3; index++) await saveAnalysisBatch(old, index, design);
  await expect(analysisCheckpoint(run, node, profile, 'design', 6, 2, {}, 2)).rejects.toThrow(
    'approval_stale',
  );
  expect(await analysisCheckpoint(run, node, profile, 'design', 3, 2, {})).toEqual(old);
});
