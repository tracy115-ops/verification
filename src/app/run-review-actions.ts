import { approveRun } from '../domain/runtime/engine';
import { clarifyRequirements, excludeReviewIssues } from '../domain/runtime/clarifications';
import { excludeCases } from '../domain/runtime/case-scope';
import { resolveScriptQuestions } from '../domain/runtime/script-revision';
import type { WorkflowRun } from '../domain/runtime/types';
import { repairRequirementQuotes } from '../domain/runtime/quote-repair';
import { recoverRequirementDraft } from '../services/requirement-recovery';

export function runReviewActions({
  perform,
  updateRun,
  drive,
  getRun,
}: {
  perform: (task: (controller: AbortController) => Promise<void>, sessionId: string) => Promise<void>;
  updateRun: (id: string, run: WorkflowRun) => void;
  drive: (run: WorkflowRun, controller: AbortController) => Promise<void>;
  getRun: (sessionId: string, runId: string) => WorkflowRun | undefined;
}) {
  function assertCurrent(run: WorkflowRun) {
    if (getRun(run.sessionId, run.id) !== run) throw new Error('approval_stale');
  }
  function change(
    run: WorkflowRun,
    transform: (current: WorkflowRun) => Promise<WorkflowRun>,
    continueRun = false,
  ) {
    return perform(async (controller) => {
      assertCurrent(run);
      const next = await transform(run);
      if (controller.signal.aborted) throw new Error('execution_cancelled');
      assertCurrent(run);
      if (continueRun) await drive(next, controller);
      else updateRun(run.sessionId, next);
    }, run.sessionId);
  }
  return {
    repairQuotes(run: WorkflowRun, quotes: Record<string, string>) {
      return change(
        run,
        async (current) => repairRequirementQuotes(await recoverRequirementDraft(current), quotes),
        true,
      );
    },
    approve(run: WorkflowRun, nodeId: string, hash: string, analysisBatchBudget?: number) {
      return change(run, (current) => approveRun(current, nodeId, hash, analysisBatchBudget), true);
    },
    clarify(
      run: WorkflowRun,
      nodeId: string,
      hash: string,
      answers: Record<string, string>,
      exclude = false,
    ) {
      return change(run, (current) =>
        (!exclude && run.plan.find((item) => item.id === nodeId)?.operation === 'review.requirements'
          ? clarifyRequirements
          : excludeReviewIssues)(current, nodeId, hash, answers),
      );
    },
    excludeCases(run: WorkflowRun, nodeId: string, hash: string, ids: string[], reason: string) {
      return change(run, (current) => excludeCases(current, nodeId, hash, ids, reason));
    },
    reviseScript(run: WorkflowRun, hash: string, answers: Record<string, string>) {
      return change(run, (current) => resolveScriptQuestions(current, hash, answers), true);
    },
  };
}
