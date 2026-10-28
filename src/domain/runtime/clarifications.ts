import type { WorkflowRun } from './types';
import { reviewDigest } from './approvals';
import { reviewIssues } from './handlers';

export async function clarifyRequirements(
  initial: WorkflowRun,
  nodeId: string,
  expectedDigest: string,
  answers: Record<string, string>,
): Promise<WorkflowRun> {
  const run = structuredClone(initial);
  const node = run.plan.find((item) => item.id === nodeId);
  if (
    run.status !== 'awaiting_review' ||
    !node ||
    node.operation !== 'review.requirements' ||
    run.steps[nodeId]?.status !== 'awaiting_review'
  )
    throw new Error('approval_invalid');
  if (expectedDigest !== run.steps[nodeId].reviewDigest || expectedDigest !== (await reviewDigest(run, node)))
    throw new Error('approval_stale');
  const pending = reviewIssues(run, node);
  if (Object.keys(answers).some((question) => !pending.includes(question)))
    throw new Error('approval_invalid');
  const entries = Object.entries(answers).filter(([, answer]) => answer.trim());
  if (
    !entries.length ||
    (run.clarifications?.length ?? 0) + entries.length > 200 ||
    entries.some(([question, answer]) => question.length > 12000 || answer.trim().length > 12000)
  )
    throw new Error('approval_invalid');
  run.clarifications = [
    ...(run.clarifications ?? []),
    ...entries.map(([question, answer]) => ({
      question,
      answer: answer.trim(),
      recordedAt: new Date().toISOString(),
    })),
  ];
  run.steps[nodeId].reviewDigest = await reviewDigest(run, node);
  return run;
}

export async function excludeReviewIssues(
  initial: WorkflowRun,
  nodeId: string,
  expectedDigest: string,
  reasons: Record<string, string>,
): Promise<WorkflowRun> {
  const run = structuredClone(initial);
  const node = run.plan.find((item) => item.id === nodeId);
  if (
    run.status !== 'awaiting_review' ||
    !node ||
    !['review.requirements', 'review.coverage', 'review.cases'].includes(node.operation) ||
    run.steps[nodeId]?.status !== 'awaiting_review'
  )
    throw new Error('approval_invalid');
  if (expectedDigest !== run.steps[nodeId].reviewDigest || expectedDigest !== (await reviewDigest(run, node)))
    throw new Error('approval_stale');
  const pending = reviewIssues(run, node);
  if (Object.keys(reasons).some((issue) => !pending.includes(issue))) throw new Error('approval_invalid');
  const entries = Object.entries(reasons).filter(([, reason]) => reason.trim());
  if (
    !entries.length ||
    (run.reviewExclusions?.length ?? 0) + entries.length > 200 ||
    entries.some(([issue, reason]) => issue.length > 12000 || reason.trim().length > 12000)
  )
    throw new Error('approval_invalid');
  run.reviewExclusions = [
    ...(run.reviewExclusions ?? []),
    ...entries.map(([issue, reason]) => ({
      nodeId,
      issue,
      reason: reason.trim(),
      recordedAt: new Date().toISOString(),
    })),
  ];
  run.steps[nodeId].reviewDigest = await reviewDigest(run, node);
  return run;
}
