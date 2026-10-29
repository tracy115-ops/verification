import { expect, it } from 'vitest';
import { advanceRun, approveRun } from './engine';
import { reviseDesign } from './design-revision';
import { design, fixturePort, fixtureRun } from './fixtures.test-support';
import { latestArtifact } from './bindings';
import { loadConversations, saveConversations } from '../../services/conversation-repository';

async function completed() {
  let run = fixtureRun();
  const { port } = fixturePort();
  for (let i = 0; i < 3; i++) {
    run = await advanceRun(
      run,
      port,
      new AbortController().signal,
      () => {},
      () => {},
    );
    const node = run.plan.find((item) => run.steps[item.id].status === 'awaiting_review')!;
    run = await approveRun(run, node.id, run.steps[node.id].reviewDigest!);
  }
  return advanceRun(
    run,
    port,
    new AbortController().signal,
    () => {},
    () => {},
  );
}

it('archives prior results, reopens coverage review, regenerates downstream cases and survives reload', async () => {
  const initial = await completed();
  const oldApproval = initial.approvals.find(
    (item) => item.nodeId === initial.plan.find((n) => n.operation === 'review.coverage')!.id,
  )!;
  initial.artifacts['coverage.declarations'] = {
    type: 'CaseCoverageDeclarations',
    value: { events: [] },
    digest: 'old',
  };
  const next = await reviseDesign(
    initial,
    { ...design, strategy: 'Human clarified strategy' },
    'Review boundary coverage',
  );
  const review = next.plan.find((node) => node.operation === 'review.coverage')!;
  expect(initial.status).toBe('completed');
  expect(next.status).toBe('awaiting_review');
  expect(latestArtifact(next, 'TestCaseSet')).toBeUndefined();
  expect(latestArtifact(next, 'TestDesign')).toBeUndefined();
  expect(next.artifacts['coverage.declarations']).toBeUndefined();
  expect(next.approvals).toHaveLength(1);
  expect(next.artifacts['history.design.1'].value).toMatchObject({
    source: 'human',
    reason: 'Review boundary coverage',
    artifacts: initial.artifacts,
  });
  await expect(approveRun(next, review.id, oldApproval.digest)).rejects.toThrow('approval_stale');
  const confirmed = await approveRun(next, review.id, next.steps[review.id].reviewDigest!);
  const progressed = await advanceRun(
    confirmed,
    fixturePort().port,
    new AbortController().signal,
    () => {},
    () => {},
  );
  expect(progressed.status).toBe('awaiting_review');
  expect(
    progressed.plan.find((node) => progressed.steps[node.id].status === 'awaiting_review')?.operation,
  ).toBe('review.cases');
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  saveConversations(storage, [
    { id: next.sessionId, title: 'Revision', profileId: next.defaultProfileId, messages: [], runs: [next] },
  ]);
  expect(loadConversations(storage)[0].runs[0]).toEqual(next);
});

it('rejects invalid references, running edits and duplicate factor IDs without changing the original', async () => {
  const run = await completed();
  const snapshot = structuredClone(run);
  await expect(reviseDesign({ ...run, status: 'running' }, design, 'reason')).rejects.toThrow(
    'approval_invalid',
  );
  await expect(
    reviseDesign(run, { ...design, factors: [...design.factors, design.factors[0]] }, 'reason'),
  ).rejects.toThrow('artifact_invalid');
  await expect(
    reviseDesign(
      run,
      { ...design, scenarios: [{ ...design.scenarios[0], requirementIds: ['MISSING'] }] },
      'reason',
    ),
  ).rejects.toThrow('artifact_invalid');
  expect(run).toEqual(snapshot);
});
