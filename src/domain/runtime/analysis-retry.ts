import type { WorkflowRun } from './types';

export function retryNode(run: WorkflowRun) {
  return (
    run.plan.find((node) => ['failed', 'interrupted'].includes(run.steps[node.id].status)) ??
    (run.errorCode === 'run_deadline' || run.status === 'cancelled'
      ? run.plan.find((node) => ['pending', 'awaiting_review'].includes(run.steps[node.id].status))
      : undefined)
  );
}

export function canRetryAnalysisInBatches(run: WorkflowRun) {
  if (!['failed', 'interrupted', 'cancelled'].includes(run.status)) return false;
  const node = retryNode(run);
  return (
    !!node &&
    ['requirements.extract', 'scenarios.design'].includes(node.operation) &&
    !run.steps[node.id].analysis
  );
}
