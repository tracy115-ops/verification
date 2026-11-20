import type { useConversationStore } from './useConversationStore';
import type { useSessionTasks } from './useSessionTasks';
import { reviewCandidate, type CandidateReviewInput } from '../domain/runtime/candidate-review';
import type { WorkflowRun } from '../domain/runtime/types';

export function candidateReviewActions(
  store: ReturnType<typeof useConversationStore>,
  tasks: ReturnType<typeof useSessionTasks>,
) {
  async function saveCandidateReview(run: WorkflowRun, input: CandidateReviewInput) {
    let accepted = false;
    await tasks.perform(async (controller) => {
      const current = () => store.getSession(run.sessionId)?.runs.find((item) => item.id === run.id);
      if (current() !== run) throw new Error('approval_stale');
      const next = await reviewCandidate(run, input);
      if (controller.signal.aborted) throw new Error('execution_cancelled');
      if (current() !== run) throw new Error('approval_stale');
      store.updateRun(run.sessionId, next);
      accepted = true;
    }, run.sessionId);
    return accepted;
  }
  return { saveCandidateReview };
}
