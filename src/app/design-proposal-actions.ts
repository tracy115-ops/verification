import type { useConversationStore } from './useConversationStore';
import type { useSessionTasks } from './useSessionTasks';
import type { AgentPort, WorkflowRun } from '../domain/runtime/types';
import type { AgentProfile } from '../domain/workflow';
import {
  designProposalTask,
  createDesignProposal,
  applyDesignProposal,
  designProposals,
  proposalContext,
} from '../domain/runtime/design-proposals';
import { isDesignProposal, type DesignProposal } from '../domain/runtime/design-proposal-schema';
import { proposalActions } from './proposal-actions';

export function designProposalActions(
  store: ReturnType<typeof useConversationStore>,
  tasks: ReturnType<typeof useSessionTasks>,
  port: AgentPort,
  profiles: AgentProfile[],
) {
  const shared = proposalActions<DesignProposal>(store, tasks, port, profiles, {
    type: 'DesignChangeProposal',
    prefix: 'design_proposal',
    key: (id) => `proposal.design.${id}`,
    context: proposalContext,
    task: designProposalTask,
    create: createDesignProposal,
    apply: applyDesignProposal,
    list: designProposals,
    validate: isDesignProposal,
  });
  function prepareDesignRepair(run: WorkflowRun, instruction: string) {
    const session = store.getSession(run.sessionId);
    const current = session?.runs.find((item) => item.id === run.id);
    if (
      !session ||
      current !== run ||
      ['ready', 'running'].includes(run.status) ||
      tasks.isSessionBusy(session.id) ||
      session.activeTurnId
    )
      return false;
    const draft = store.getComposerDraft(session.id);
    const text = draft?.text.trim()
      ? draft.text.endsWith(instruction)
        ? draft.text
        : `${draft.text}\n\n${instruction}`
      : instruction;
    if (text.length > 40000) {
      store.setError('prompt_too_large');
      return false;
    }
    const id = store.updateComposerDraft(
      { text, invoke: false, editDesign: true, editCases: false },
      session.profileId,
      session.id,
    );
    if (!id) return false;
    store.setActiveId(id);
    return true;
  }
  return { proposeDesign: shared.propose, decideDesignProposal: shared.decide, prepareDesignRepair };
}
