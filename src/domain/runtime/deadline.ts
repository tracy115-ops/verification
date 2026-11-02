import type { WorkflowNode } from '../workflow';
import type { WorkflowRun } from './types';

export function runDeadline(run: WorkflowRun): number {
  return Date.parse(run.resumedAt ?? run.createdAt) + run.snapshot.definition.limits.deadlineSeconds * 1000;
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
