import type { AgentPort, WorkflowRun } from '../domain/runtime/types';
import { recordActivity, type CliTurnRecord } from '../domain/runtime/transcript';
import { transcriptStore, type TranscriptStore } from './transcript-store';

export function recordedAgent(
  base: AgentPort,
  context?: WorkflowRun | (() => WorkflowRun),
  store: TranscriptStore = transcriptStore,
): AgentPort {
  return {
    async send(request, onEvent, signal) {
      const run = typeof context === 'function' ? context() : context;
      let operation = 'conversation';
      try {
        const task = JSON.parse(request.prompt);
        if (typeof task.operation === 'string') operation = task.operation;
      } catch {
        /* Plain prompts remain valid CLI input. */
      }
      const record: CliTurnRecord = {
        version: 1,
        id: request.turnId,
        sessionId: request.sessionId,
        ...(run
          ? {
              runId: run.id,
              nodeId:
                run.plan.find((node) => run.steps[node.id]?.turnId === request.turnId)?.id ??
                (run.plan.filter((node) => node.operation === operation).length === 1
                  ? run.plan.find((node) => node.operation === operation)?.id
                  : undefined),
            }
          : {}),
        operation,
        request: structuredClone(request),
        startedAt: new Date().toISOString(),
        status: 'running',
        text: '',
        activities: [],
      };
      store.save(record, true);
      try {
        const outcome = await base.send(
          request,
          (event) => {
            if (event.type === 'text' || event.type === 'activity') {
              recordActivity(record, event);
              store.save(record);
            }
            onEvent(event);
          },
          signal,
        );
        record.status = outcome.status;
        if (outcome.text || !record.text) record.text = outcome.text;
        record.errorCode = outcome.errorCode ?? undefined;
        return outcome;
      } catch (error) {
        record.status = signal.aborted ? 'cancelled' : 'failed';
        record.errorCode =
          error instanceof Error && /^[a-z_]{1,80}$/.test(error.message) ? error.message : 'runtime_failed';
        throw error;
      } finally {
        record.finishedAt = new Date().toISOString();
        store.save(record, true);
      }
    },
    cancel: (id) => base.cancel(id),
  };
}
