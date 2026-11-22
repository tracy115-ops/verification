import type { WorkflowRun } from './types';
import { descendants } from './descendants';
import { digest } from './plan';

export async function recordExecutionRetry(initial: WorkflowRun) {
  const node = initial.plan.find((item) => item.operation === 'targets.execute');
  const step = node && initial.steps[node.id];
  if (!step?.executionId || !['failed', 'interrupted'].includes(step.status)) return initial;
  const value = {
    version: 1,
    executionId: step.executionId,
    status: initial.status,
    errorCode: step.errorCode ?? initial.errorCode ?? 'execution_failed',
    recordedAt: new Date().toISOString(),
  };
  const run = structuredClone(initial);
  run.artifacts[`history.execution.${step.executionId}.outcome`] = {
    type: 'ExecutionRetryOutcome',
    value,
    digest: await digest(value),
  };
  return run;
}

/** A stopped executor may have consumed its single-use workspace. Require a fresh plan and approval. */
export function resetExecutionRetry(run: WorkflowRun) {
  const preflight = run.plan.find((node) => node.operation === 'targets.preflight');
  if (!preflight) throw new Error('invalid_run');
  const affected = descendants(run.plan, [preflight.id]);
  for (const node of run.plan) {
    if (!affected.has(node.id)) continue;
    if (node.operation === 'targets.preflight') {
      for (const slot of Object.keys(node.outputs)) {
        const artifact = run.artifacts[`${node.id}.${slot}`];
        const executionId = run.steps[node.id].executionId;
        if (artifact && executionId)
          run.artifacts[`history.execution.${executionId}`] = { ...artifact, type: 'ExecutionPlanHistory' };
      }
    }
    run.steps[node.id] = { status: 'pending', attempts: 0 };
    for (const slot of Object.keys(node.outputs)) delete run.artifacts[`${node.id}.${slot}`];
  }
  run.approvals = run.approvals.filter((item) => !affected.has(item.nodeId));
}
