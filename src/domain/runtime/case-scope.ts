import { latestArtifact } from './bindings';
import { isCases } from './artifacts';
import { reviewDigest } from './approvals';
import type { CaseArtifact, WorkflowRun } from './types';

export function scopedCases(run: WorkflowRun, value: CaseArtifact): CaseArtifact {
  const review = run.plan.find((node) => node.operation === 'review.cases');
  const excluded = new Set(
    run.reviewExclusions?.filter((entry) => entry.nodeId === review?.id).map((entry) => entry.issue),
  );
  return { cases: value.cases.filter((item) => !excluded.has(`case:${item.id}`)) };
}

export async function excludeCases(
  initial: WorkflowRun,
  nodeId: string,
  expectedDigest: string,
  ids: string[],
  reason: string,
): Promise<WorkflowRun> {
  const run = structuredClone(initial);
  const node = run.plan.find((item) => item.id === nodeId);
  if (
    run.status !== 'awaiting_review' ||
    node?.operation !== 'review.cases' ||
    run.steps[nodeId]?.status !== 'awaiting_review'
  )
    throw new Error('approval_invalid');
  if (expectedDigest !== run.steps[nodeId].reviewDigest || expectedDigest !== (await reviewDigest(run, node)))
    throw new Error('approval_stale');
  const draft = latestArtifact(run, 'TestCaseSetDraft');
  if (!isCases(draft)) throw new Error('artifact_invalid');
  const eligible = scopedCases(run, draft);
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    !reason.trim() ||
    reason.trim().length > 12000 ||
    ids.some((id) => !eligible.cases.some((item) => item.id === id)) ||
    ids.length >= eligible.cases.length ||
    (run.reviewExclusions?.length ?? 0) + ids.length > 200
  )
    throw new Error('approval_invalid');
  run.reviewExclusions = [
    ...(run.reviewExclusions ?? []),
    ...ids.map((id) => ({
      nodeId,
      issue: `case:${id}`,
      reason: reason.trim(),
      recordedAt: new Date().toISOString(),
    })),
  ];
  run.steps[nodeId].reviewDigest = await reviewDigest(run, node);
  return run;
}
