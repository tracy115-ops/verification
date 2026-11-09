import type { useConversationStore } from './useConversationStore';
import type { useSessionTasks } from './useSessionTasks';
import type { AgentPort, Artifact, WorkflowRun } from '../domain/runtime/types';
import type { AgentProfile } from '../domain/workflow';
import type { ProposalRecord } from '../domain/runtime/proposal-envelope';
import { nativeAgentFields } from '../domain/runtime/profile';
import { message } from '../domain/runtime/chat';
import { parseArtifact } from '../domain/runtime/artifacts';
import { newId } from '../shared/id';
import { recordedAgent } from '../services/recorded-agent';
import { transcriptStore } from '../services/transcript-store';
import { digest } from '../domain/runtime/plan';

export interface ProposalConfig<T extends ProposalRecord> {
  type: string;
  prefix: string;
  key: (id: string) => string;
  context: (run: WorkflowRun) => unknown;
  task: (run: WorkflowRun, instruction: string) => string;
  list: (run: WorkflowRun) => T[];
  validate: (value: unknown) => value is T;
  create: (run: WorkflowRun, patch: unknown, instruction: string, turnId: string) => Promise<T>;
  apply: (run: WorkflowRun, proposal: T) => Promise<WorkflowRun>;
}

export function proposalActions<T extends ProposalRecord>(
  store: ReturnType<typeof useConversationStore>,
  tasks: ReturnType<typeof useSessionTasks>,
  port: AgentPort,
  profiles: AgentProfile[],
  config: ProposalConfig<T>,
) {
  const artifactFor = async (value: T): Promise<Artifact> => ({
    type: config.type,
    value,
    digest: await digest(value),
  });
  async function propose(selected: WorkflowRun, instruction: string, profileId: string) {
    const session = store.getSession(selected.sessionId);
    const run = session?.runs.find((item) => item.id === selected.id);
    if (!session || !run || tasks.isSessionBusy(session.id) || !instruction.trim()) return false;
    let accepted = false;
    await tasks.perform(async (controller) => {
      config.context(run);
      if (session.activeTurnId) throw new Error('previous_turn_active');
      if (config.list(run).filter((item) => item.status === 'pending').length >= 20)
        throw new Error(`${config.prefix}_limit`);
      const profile = profiles.find((item) => item.id === profileId);
      if (!profile) throw new Error('profile_missing');
      const request = {
        turnId: newId(),
        sessionId: session.id,
        ...nativeAgentFields(profile),
        prompt: config.task(run, instruction),
        timeoutSeconds: 600,
      };
      const userMessage = message('user', instruction);
      store.patchSession(session.id, (current) => ({
        ...current,
        activeTurnId: request.turnId,
        messages: [...current.messages, userMessage],
      }));
      store.acceptComposerDraft(session.id, instruction);
      accepted = true;
      try {
        const result = await recordedAgent(port, run).send(
          request,
          (event) => tasks.onEvent(session.id, event),
          controller.signal,
        );
        if (controller.signal.aborted) throw new Error('execution_cancelled');
        if (result.status !== 'completed') throw new Error(result.errorCode ?? 'cli_failed');
        let proposal: T;
        try {
          proposal = await config.create(run, parseArtifact(result.text), instruction, request.turnId);
        } catch (error) {
          transcriptStore.validation(
            request.turnId,
            error instanceof Error ? error.message : `${config.prefix}_invalid`,
          );
          throw error;
        }
        const artifact = await artifactFor(proposal);
        if (controller.signal.aborted) throw new Error('execution_cancelled');
        store.patchSession(session.id, (current) => ({
          ...current,
          runs: current.runs.map((latest) =>
            latest.id === run.id
              ? { ...latest, artifacts: { ...latest.artifacts, [config.key(proposal.id)]: artifact } }
              : latest,
          ),
        }));
      } finally {
        store.patchSession(session.id, (current) => {
          if (current.activeTurnId !== request.turnId) return current;
          const settled = { ...current };
          delete settled.activeTurnId;
          return settled;
        });
      }
    }, session.id);
    return accepted;
  }
  async function decide(selected: WorkflowRun, id: string, apply: boolean) {
    await tasks.perform(async () => {
      const session = store.getSession(selected.sessionId);
      if (session?.activeTurnId) throw new Error('previous_turn_active');
      const run = session?.runs.find((item) => item.id === selected.id);
      const proposal = run?.artifacts[config.key(id)]?.value;
      if (!run || !config.validate(proposal) || proposal.status !== 'pending')
        throw new Error(`${config.prefix}_invalid`);
      const expected = selected.artifacts[config.key(id)]?.digest;
      if (
        !expected ||
        expected !== run.artifacts[config.key(id)].digest ||
        expected !== (await digest(proposal))
      )
        throw new Error(`${config.prefix}_stale`);
      const next = apply ? await config.apply(run, proposal) : run;
      const decision = {
        ...proposal,
        status: apply ? 'applied' : 'dismissed',
        decidedAt: new Date().toISOString(),
      } as T;
      const artifact = await artifactFor(decision);
      const stale = await artifactFor({ ...proposal, status: 'stale', decidedAt: decision.decidedAt });
      store.patchSession(run.sessionId, (current) => ({
        ...current,
        runs: current.runs.map((latest) => {
          if (latest.id !== run.id) return latest;
          if (latest !== run) {
            const pending = latest.artifacts[config.key(id)]?.value;
            return config.validate(pending) && pending.status === 'pending'
              ? { ...latest, artifacts: { ...latest.artifacts, [config.key(id)]: stale } }
              : latest;
          }
          return { ...next, artifacts: { ...next.artifacts, [config.key(id)]: artifact } };
        }),
      }));
    }, selected.sessionId);
  }
  return { propose, decide };
}
