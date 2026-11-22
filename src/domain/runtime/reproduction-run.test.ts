import { expect, it, vi } from 'vitest';
import { reportRunFixture } from '../../../tests/fixtures/report-run';
import { createReproductionRun } from './reproduction-run';
import { reproductionSource } from './reproduction-source';
import { advanceRun, approveRun, retryRun } from './engine';
import { latestArtifact } from './bindings';
import { digest } from './plan';
import { reproductionObservations } from './reproduction-observations';
import { decodeConversations } from '../../services/conversation-repository';
import { addReview } from '../document';
import { reviseCases, caseContext } from './case-revision';
import type { AgentPort } from './types';
import type { ExecutionPort, ExecutionPlan, EvidenceBundle, VerificationReport } from '../execution/types';

function setup(status: 'failed' | 'passed' | 'error' = 'failed') {
  const source = reportRunFixture();
  const report = Object.values(source.artifacts).find((item) => item.type === 'VerificationReport')!;
  const candidateId = (report.value as VerificationReport).candidates[0].id;
  const originalPlan = latestArtifact(source, 'ExecutionPlan') as ExecutionPlan;
  const oldEvidence = latestArtifact(source, 'EvidenceBundle') as EvidenceBundle;
  const agent: AgentPort = {
    send: vi.fn(async () => {
      throw new Error('unexpected_model_call');
    }),
    cancel: async () => {},
  };
  const execution: ExecutionPort = {
    preflight: vi.fn(async (payload) => ({
      ...structuredClone(originalPlan),
      payload,
      digest: await digest(payload),
    })),
    execute: vi.fn(async (plan) => ({
      ...structuredClone(oldEvidence),
      executionId: plan.payload.executionId,
      planDigest: plan.digest,
      results: oldEvidence.results.map((item) => ({
        ...item,
        status: item.status === 'failed' ? status : item.status,
      })),
    })),
    cancel: async () => {},
  };
  return { source, report, candidateId, agent, execution };
}
async function executeReplay(value: ReturnType<typeof setup>) {
  let run = await createReproductionRun(value.source, value.report.digest, value.candidateId);
  run = await advanceRun(
    run,
    value.agent,
    new AbortController().signal,
    () => {},
    () => {},
    value.execution,
  );
  expect(run.status).toBe('awaiting_review');
  expect(value.execution.execute).not.toHaveBeenCalled();
  const review = run.plan.find((node) => node.operation === 'review.execution')!;
  run = await approveRun(run, review.id, run.steps[review.id].reviewDigest!);
  run = await advanceRun(
    run,
    value.agent,
    new AbortController().signal,
    () => {},
    () => {},
    value.execution,
  );
  expect(run.status).toBe('completed');
  expect(value.agent.send).not.toHaveBeenCalled();
  return run;
}
it('forks immutable approved inputs, requires new execution approval and completes without model calls', async () => {
  const value = setup();
  const before = structuredClone(value.source);
  const run = await executeReplay(value);
  expect(value.source).toEqual(before);
  expect(run.id).not.toBe(value.source.id);
  expect(reproductionSource(run)).toMatchObject({
    sourceRunId: value.source.id,
    candidateId: value.candidateId,
  });
  expect(latestArtifact(run, 'VerificationReport')).toBeUndefined();
  expect(run.plan.some((node) => node.operation === 'verdicts.evaluate')).toBe(false);
  expect((latestArtifact(run, 'EvidenceBundle') as EvidenceBundle).executionId).not.toBe(
    (latestArtifact(value.source, 'EvidenceBundle') as EvidenceBundle).executionId,
  );
  expect(
    decodeConversations([
      {
        id: run.sessionId,
        title: 'Replay',
        profileId: run.defaultProfileId,
        messages: [],
        runs: [value.source, run],
      },
    ])[0].runs,
  ).toHaveLength(2);
});
it('compares actual matching trials without claiming that one failure establishes repeatability', async () => {
  const first = await executeReplay(setup());
  expect(reproductionObservations(first, [first])[0]).toMatchObject({ status: 'observed_failure' });
  const second = await executeReplay(setup());
  expect(reproductionObservations(first, [first, second])[0]).toMatchObject({ status: 'repeated_failure' });
  const passed = await executeReplay(setup('passed'));
  expect(reproductionObservations(first, [first, passed])[0]).toMatchObject({ status: 'intermittent' });
  const error = await executeReplay(setup('error'));
  expect(reproductionObservations(first, [first, error])[0]).toMatchObject({ status: 'inconclusive' });
  (latestArtifact(passed, 'ExecutionPlan') as ExecutionPlan).pythonVersion = 'different-environment';
  expect(reproductionObservations(first, [first, passed])[0]).toMatchObject({
    status: 'observed_failure',
    counts: { failed: 1, passed: 0 },
  });
});
it('forces a new preflight and approval when retrying a stopped executor', async () => {
  const value = setup();
  let run = await createReproductionRun(value.source, value.report.digest, value.candidateId);
  run = await advanceRun(
    run,
    value.agent,
    new AbortController().signal,
    () => {},
    () => {},
    value.execution,
  );
  const review = run.plan.find((node) => node.operation === 'review.execution')!;
  run = await approveRun(run, review.id, run.steps[review.id].reviewDigest!);
  value.execution.execute = vi.fn(async () => {
    throw new Error('execution_cancelled');
  });
  run = await advanceRun(
    run,
    value.agent,
    new AbortController().signal,
    () => {},
    () => {},
    value.execution,
  );
  const oldId = (latestArtifact(run, 'ExecutionPlan') as ExecutionPlan).payload.executionId;
  run = retryRun(run);
  expect(latestArtifact(run, 'ExecutionPlan')).toBeUndefined();
  expect(latestArtifact(run, 'ExecutionAuthorization')).toBeUndefined();
  run = await advanceRun(
    run,
    value.agent,
    new AbortController().signal,
    () => {},
    () => {},
    value.execution,
  );
  expect(run.status).toBe('awaiting_review');
  expect((latestArtifact(run, 'ExecutionPlan') as ExecutionPlan).payload.executionId).not.toBe(oldId);
});

it('repeats custom execution gates and marks inherited analysis as read-only', async () => {
  const value = setup();
  const preflight = value.source.plan.find((node) => node.operation === 'targets.preflight')!;
  value.source.snapshot = addReview(value.source.snapshot, preflight.id);
  const extra = value.source.snapshot.definition.nodes.at(-1)!;
  value.source.plan.push(structuredClone(extra));
  for (const plan of [value.source.plan, value.source.snapshot.definition.nodes])
    plan.find((node) => node.operation === 'review.execution')!.dependsOn = [extra.id];
  value.source.steps[extra.id] = { status: 'succeeded', attempts: 1 };
  value.source.approvals.push({
    nodeId: extra.id,
    digest: 'original-approval',
    approvedAt: value.source.createdAt,
  });
  let run = await createReproductionRun(value.source, value.report.digest, value.candidateId);
  expect(reproductionSource(run)?.inheritedNodeIds).not.toContain(extra.id);
  expect(run.approvals.some((item) => item.nodeId === extra.id)).toBe(false);
  await expect(reviseCases(run, caseContext(run).cases, 'Change replay oracle')).rejects.toThrow(
    'reproduction_readonly',
  );
  run = await advanceRun(
    run,
    value.agent,
    new AbortController().signal,
    () => {},
    () => {},
    value.execution,
  );
  expect(run.steps[extra.id].status).toBe('awaiting_review');
  expect(value.execution.execute).not.toHaveBeenCalled();
  run = await approveRun(run, extra.id, run.steps[extra.id].reviewDigest!);
  run = await advanceRun(
    run,
    value.agent,
    new AbortController().signal,
    () => {},
    () => {},
    value.execution,
  );
  expect(run.status).toBe('awaiting_review');
  expect(run.plan.find((node) => run.steps[node.id].status === 'awaiting_review')?.operation).toBe(
    'review.execution',
  );
});

it('restores an unfinished replay as interrupted and rejects a corrupt source association', async () => {
  const value = setup();
  const run = await createReproductionRun(value.source, value.report.digest, value.candidateId);
  run.status = 'running';
  const preflight = run.plan.find((node) => node.operation === 'targets.preflight')!;
  run.steps[preflight.id].status = 'running';
  const session = {
    id: run.sessionId,
    title: 'Recovery',
    profileId: run.defaultProfileId,
    messages: [],
    runs: [run],
  };
  const restored = decodeConversations([session])[0].runs[0];
  expect(restored.status).toBe('interrupted');
  expect(restored.steps[preflight.id].status).toBe('interrupted');
  expect(value.execution.execute).not.toHaveBeenCalled();
  reproductionSource(run)!.inheritedNodeIds = [];
  expect(() => decodeConversations([session])).toThrow('session_storage_invalid');
});
