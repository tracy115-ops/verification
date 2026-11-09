import { retryRun } from '../domain/runtime/engine';
import { recoverRequirementDraft } from '../services/requirement-recovery';
import type { AgentPort, WorkflowRun } from '../domain/runtime/types';
import type { useConversationStore } from './useConversationStore';
import type { useSessionTasks } from './useSessionTasks';
import type { ExecutionPort } from '../domain/execution/types';

export function runRetryAction(
  store: ReturnType<typeof useConversationStore>,
  perform: ReturnType<typeof useSessionTasks>['perform'],
  port: AgentPort,
  executionPort: ExecutionPort,
  drive: (run: WorkflowRun, controller: AbortController) => Promise<void>,
) {
  async function retry(
    run: WorkflowRun,
    forceBatchAnalysis = false,
    analysisTimeoutSeconds?: number,
    analysisBatchBudget?: number,
  ) {
    await perform(async (controller) => {
      const current = store.getSession(run.sessionId);
      if (current?.runs.find((item) => item.id === run.id) !== run) throw new Error('approval_stale');
      if (
        current.runs.some(
          (other) => other.id !== run.id && ['ready', 'running', 'awaiting_review'].includes(other.status),
        )
      )
        throw new Error('run_in_progress');
      const previous = run.plan
        .map((node) => run.steps[node.id])
        .find((step) => ['failed', 'interrupted'].includes(step.status));
      if (previous?.turnId) await port.cancel(previous.turnId);
      if (previous?.executionId) await executionPort.cancel(previous.executionId);
      const recovered = await recoverRequirementDraft(run);
      if (controller.signal.aborted) throw new Error('execution_cancelled');
      if (store.getSession(run.sessionId)?.runs.find((item) => item.id === run.id) !== run)
        throw new Error('approval_stale');
      await drive(
        retryRun(recovered, forceBatchAnalysis, analysisTimeoutSeconds, analysisBatchBudget),
        controller,
      );
    }, run.sessionId);
  }
  return retry;
}
