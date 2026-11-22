import type { useConversationStore } from './useConversationStore';
import type { useSessionTasks } from './useSessionTasks';
import type { WorkflowRun } from '../domain/runtime/types';
import { createReproductionRun } from '../domain/runtime/reproduction-run';
import { validateConversationPayload } from '../services/conversation-storage';
import { MAX_RUNS_PER_SESSION } from '../services/conversation-repository';

export function reproductionActions(
  store: ReturnType<typeof useConversationStore>,
  tasks: ReturnType<typeof useSessionTasks>,
  drive: (run: WorkflowRun, controller: AbortController) => Promise<void>,
  selectRun: (id: string) => void,
) {
  async function startReproduction(source: WorkflowRun, reportDigest: string, candidateId: string) {
    let accepted = false;
    await tasks.perform(async (controller) => {
      const current = () => store.getSession(source.sessionId);
      if (current()?.runs.find((item) => item.id === source.id) !== source) throw new Error('approval_stale');
      if (current()!.runs.length >= MAX_RUNS_PER_SESSION) throw new Error('store_limit');
      if (
        current()!.activeTurnId ||
        current()!.runs.some((run) => ['ready', 'running', 'awaiting_review'].includes(run.status))
      )
        throw new Error('run_in_progress');
      const run = await createReproductionRun(source, reportDigest, candidateId);
      if (controller.signal.aborted) throw new Error('execution_cancelled');
      if (current()?.runs.find((item) => item.id === source.id) !== source) throw new Error('approval_stale');
      const session = { ...current()!, runs: [...current()!.runs, run] };
      validateConversationPayload(
        JSON.stringify(store.getSessions().map((item) => (item.id === session.id ? session : item))),
      );
      store.changeSession(session);
      store.setActiveId(session.id);
      selectRun(run.id);
      accepted = true;
      await drive(run, controller);
    }, source.sessionId);
    return accepted;
  }
  return { startReproduction };
}
