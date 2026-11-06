import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fixtureRun } from './fixtures.test-support';
import { decodeDesign, decodeRequirements } from './artifacts';
import { reviewIssues } from './handlers';
import { applyDesignProposal, createDesignProposal } from './design-proposals';
import { latestArtifact } from './bindings';

const folder = '../../../docs/examples/generated/live-claude-design-2026-11-06/';
const read = (name: string) => readFileSync(new URL(`${folder}${name}`, import.meta.url), 'utf8');

it('blocks a real incomplete design despite empty gaps, then reopens review after the Agent patch', async () => {
  const run = fixtureRun();
  run.spec = read('source.txt');
  const requirements = decodeRequirements(JSON.parse(read('requirements.json')), run.spec);
  const design = decodeDesign(JSON.parse(read('design-before.json')), requirements);
  const review = run.plan.find((node) => node.operation === 'review.coverage')!;
  const producer = run.plan.find((node) => node.operation === 'scenarios.design')!;
  run.artifacts = {
    [review.inputs.requirements.from]: {
      type: 'RequirementBaseline',
      value: requirements,
      digest: 'fixture',
    },
    [review.inputs.design.from]: { type: 'TestDesignDraft', value: design, digest: 'fixture' },
  };
  run.status = 'awaiting_review';
  run.steps[producer.id].status = 'succeeded';
  expect(design.gaps).toEqual([]);
  expect(reviewIssues(run, review)).toEqual(['F-isolation: no room shared between tests']);

  const proposal = await createDesignProposal(
    run,
    JSON.parse(read('repair-patch.json')),
    'Repair the missing fixed fixture condition mapping',
    crypto.randomUUID(),
  );
  expect(reviewIssues(run, review)).toHaveLength(1);
  const repaired = await applyDesignProposal(run, proposal);
  expect(repaired.status).toBe('awaiting_review');
  expect(reviewIssues(repaired, review)).toEqual([]);
  expect(latestArtifact(repaired, 'TestDesign')).toBeUndefined();
  expect(latestArtifact(repaired, 'DesignRevision')).toBeDefined();
  const updated = decodeDesign(latestArtifact(repaired, 'TestDesignDraft'), requirements);
  expect(updated.scenarios.map((item) => item.id)).toEqual(design.scenarios.map((item) => item.id));
  expect(updated.factors).toEqual(design.factors);
  expect(repaired.approvals.some((item) => item.nodeId === review.id)).toBe(false);
});
