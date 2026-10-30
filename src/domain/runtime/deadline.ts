import type { WorkflowNode } from '../workflow';
import type { WorkflowRun } from './types';

export function remainingNodeSeconds(run: WorkflowRun, node: WorkflowNode): number {
  const remaining =
    Date.parse(run.createdAt) + run.snapshot.definition.limits.deadlineSeconds * 1000 - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) throw new Error('run_deadline');
  return Math.max(1, Math.min(Math.ceil(remaining / 1000), node.policy.timeoutSeconds, 86400));
}
