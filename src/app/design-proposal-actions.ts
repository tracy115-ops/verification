import type { useConversationStore } from './useConversationStore';
import type { useSessionTasks } from './useSessionTasks';
import type { AgentPort, WorkflowRun, Artifact } from '../domain/runtime/types';
import type { AgentProfile } from '../domain/workflow';
import {
  designProposalTask,
  createDesignProposal,
  applyDesignProposal,
  designProposals,
  proposalContext,
} from '../domain/runtime/design-proposals';
import { type DesignProposal, isDesignProposal } from '../domain/runtime/design-proposal-schema';
import { parseArtifact } from '../domain/runtime/artifacts';
import { nativeAgentFields } from '../domain/runtime/profile';
import { message } from '../domain/runtime/chat';
import { newId } from '../shared/id';
import { digest } from '../domain/runtime/plan';
import { recordedAgent } from '../services/recorded-agent';
import { transcriptStore } from '../services/transcript-store';

type Store = ReturnType<typeof useConversationStore>;
type Tasks = ReturnType<typeof useSessionTasks>;
const keyFor = (id: string) => `proposal.design.${id}`;
async function proposalArtifact(proposal: DesignProposal): Promise<Artifact> {
  return { type: 'DesignChangeProposal', value: proposal, digest: await digest(proposal) };
}

export function designProposalActions(store: Store, tasks: Tasks, port: AgentPort, profiles: AgentProfile[]) {
  async function proposeDesign(
    selected: WorkflowRun,
    instruction: string,
    profileId: string,
  ): Promise<boolean> {
    const session = store.getSession(selected.sessionId);
    const run = session?.runs.find((item) => item.id === selected.id);
    if (!session || !run || tasks.isSessionBusy(session.id) || !instruction.trim()) return false;
    let accepted = false;
    await tasks.perform(async (controller) => {
      proposalContext(run);
      if (session.activeTurnId) throw new Error('previous_turn_active');
      if (designProposals(run).filter((item) => item.status === 'pending').length >= 20)
        throw new Error('design_proposal_limit');
      const profile = profiles.find((item) => item.id === profileId);
      if (!profile) throw new Error('profile_missing');
      const request = {
        turnId: newId(),
        sessionId: session.id,
        ...nativeAgentFields(profile),
        prompt: designProposalTask(run, instruction),
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
        let proposal: DesignProposal;
        try {
          proposal = await createDesignProposal(run, parseArtifact(result.text), instruction, request.turnId);
        } catch (error) {
          transcriptStore.validation(
            request.turnId,
            error instanceof Error ? error.message : 'design_proposal_invalid',
          );
          throw error;
        }
        const artifact = await proposalArtifact(proposal);
        if (controller.signal.aborted) throw new Error('execution_cancelled');
        store.patchSession(session.id, (current) => ({
          ...current,
          runs: current.runs.map((latest) =>
            latest.id === run.id
              ? { ...latest, artifacts: { ...latest.artifacts, [keyFor(proposal.id)]: artifact } }
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

  async function decideDesignProposal(selected: WorkflowRun, id: string, apply: boolean) {
    await tasks.perform(async () => {
      const session = store.getSession(selected.sessionId);
      if (session?.activeTurnId) throw new Error('previous_turn_active');
      const run = session?.runs.find((item) => item.id === selected.id);
      const proposal = run?.artifacts[keyFor(id)]?.value;
      if (!run || !isDesignProposal(proposal) || proposal.status !== 'pending')
        throw new Error('design_proposal_invalid');
      const expected = selected.artifacts[keyFor(id)]?.digest;
      if (!expected || expected !== run.artifacts[keyFor(id)].digest || expected !== (await digest(proposal)))
        throw new Error('design_proposal_stale');
      const next = apply ? await applyDesignProposal(run, proposal) : run;
      const decision: DesignProposal = {
        ...proposal,
        status: apply ? 'applied' : 'dismissed',
        decidedAt: new Date().toISOString(),
      };
      const artifact = await proposalArtifact(decision);
      const stale = await proposalArtifact({ ...proposal, status: 'stale', decidedAt: decision.decidedAt });
      store.patchSession(run.sessionId, (current) => ({
        ...current,
        runs: current.runs.map((latest) => {
          if (latest.id !== run.id) return latest;
          if (latest !== run) {
            const pending = latest.artifacts[keyFor(id)]?.value;
            return isDesignProposal(pending) && pending.status === 'pending'
              ? { ...latest, artifacts: { ...latest.artifacts, [keyFor(id)]: stale } }
              : latest;
          }
          return { ...next, artifacts: { ...next.artifacts, [keyFor(id)]: artifact } };
        }),
      }));
    }, selected.sessionId);
  }
  return { proposeDesign, decideDesignProposal };
}
