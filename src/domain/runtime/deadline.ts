import type { WorkflowNode } from '../workflow';
import type { WorkflowRun } from './types';

export function runDeadline(run: WorkflowRun): number {
  const anchor = Date.parse(run.resumedAt ?? run.createdAt);
  const waiting = run.reviewWaitMs ?? 0;
  // Legacy reviews have no pause timestamp; their current gate gets a fresh
  // budget once on approval because prior active time cannot be reconstructed.
  const paused =
    run.reviewPausedAt ?? (run.status === 'awaiting_review' ? (run.resumedAt ?? run.createdAt) : undefined);
  const pauseMs = paused ? Math.max(0, Date.now() - Date.parse(paused)) : 0;
  return anchor + run.snapshot.definition.limits.deadlineSeconds * 1000 + waiting + pauseMs;
}

export function pauseForReview(run: WorkflowRun): void {
  run.reviewPausedAt = new Date().toISOString();
}

export function resumeFromReview(run: WorkflowRun): void {
  const paused = run.reviewPausedAt;
  if (paused) run.reviewWaitMs = (run.reviewWaitMs ?? 0) + Math.max(0, Date.now() - Date.parse(paused));
  else {
    run.resumedAt = new Date().toISOString();
    delete run.reviewWaitMs;
  }
  delete run.reviewPausedAt;
}

export function renewRunBudget(run: WorkflowRun): void {
  run.resumedAt = new Date().toISOString();
  delete run.reviewPausedAt;
  delete run.reviewWaitMs;
}

export function remainingNodeSeconds(run: WorkflowRun, node: WorkflowNode): number {
  const override = run.steps[node.id]?.analysisTimeoutSeconds;
  if (
    override !== undefined &&
    (!['requirements.extract', 'scenarios.design'].includes(node.operation) ||
      !Number.isInteger(override) ||
      override < 1 ||
      override > 86400)
  )
    throw new Error('invalid_run');
  const remaining = runDeadline(run) - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) throw new Error('run_deadline');
  return Math.max(1, Math.min(Math.ceil(remaining / 1000), override ?? node.policy.timeoutSeconds, 86400));
}
