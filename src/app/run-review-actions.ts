import { approveRun } from '../domain/runtime/engine';
import { clarifyRequirements, excludeReviewIssues } from '../domain/runtime/clarifications';
import { excludeCases } from '../domain/runtime/case-scope';
import { resolveScriptQuestions } from '../domain/runtime/script-revision';
import type { WorkflowRun } from '../domain/runtime/types';

export function runReviewActions({
  perform,
  updateRun,
  drive,
}: {
  perform: (task: (controller: AbortController) => Promise<void>) => Promise<void>;
  updateRun: (id: string, run: WorkflowRun) => void;
  drive: (run: WorkflowRun, controller: AbortController) => Promise<void>;
}) {
  return {
    approve(run: WorkflowRun, nodeId: string, hash: string) {
      return perform(async (controller) => drive(await approveRun(run, nodeId, hash), controller));
    },
    clarify(
      run: WorkflowRun,
      nodeId: string,
      hash: string,
      answers: Record<string, string>,
      exclude = false,
    ) {
      return perform(async () =>
        updateRun(
          run.sessionId,
          await (
            !exclude && run.plan.find((item) => item.id === nodeId)?.operation === 'review.requirements'
              ? clarifyRequirements
              : excludeReviewIssues
          )(run, nodeId, hash, answers),
        ),
      );
    },
    excludeCases(run: WorkflowRun, nodeId: string, hash: string, ids: string[], reason: string) {
      return perform(async () =>
        updateRun(run.sessionId, await excludeCases(run, nodeId, hash, ids, reason)),
      );
    },
    reviseScript(run: WorkflowRun, hash: string, answers: Record<string, string>) {
      return perform(async (controller) =>
        drive(await resolveScriptQuestions(run, hash, answers), controller),
      );
    },
  };
}
