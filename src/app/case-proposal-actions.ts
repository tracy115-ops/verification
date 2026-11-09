import type { useConversationStore } from './useConversationStore';
import type { useSessionTasks } from './useSessionTasks';
import type { AgentPort, CaseArtifact, WorkflowRun } from '../domain/runtime/types';
import type { AgentProfile } from '../domain/workflow';
import {
  caseProposalTask,
  createCaseProposal,
  applyCaseProposal,
  caseProposals,
} from '../domain/runtime/case-proposals';
import { caseContext, reviseCases as reviseCaseSet } from '../domain/runtime/case-revision';
import { isCaseProposal, type CaseProposal } from '../domain/runtime/case-proposal-schema';
import { proposalActions } from './proposal-actions';

export function caseProposalActions(
  store: ReturnType<typeof useConversationStore>,
  tasks: ReturnType<typeof useSessionTasks>,
  port: AgentPort,
  profiles: AgentProfile[],
) {
  const shared = proposalActions<CaseProposal>(store, tasks, port, profiles, {
    type: 'CaseChangeProposal',
    prefix: 'case_proposal',
    key: (id) => `proposal.cases.${id}`,
    context: caseContext,
    task: caseProposalTask,
    create: createCaseProposal,
    apply: applyCaseProposal,
    list: caseProposals,
    validate: isCaseProposal,
  });
  function prepareCaseRepair(run: WorkflowRun, instruction = '') {
    const session = store.getSession(run.sessionId);
    if (
      !session ||
      session.runs.find((item) => item.id === run.id) !== run ||
      tasks.isSessionBusy(session.id) ||
      ['ready', 'running'].includes(run.status) ||
      session.activeTurnId
    )
      return false;
    const previous = store.getComposerDraft(session.id);
    const text =
      !instruction || previous?.text.endsWith(instruction)
        ? (previous?.text ?? '')
        : previous?.text.trim()
          ? `${previous.text}\n\n${instruction}`
          : instruction;
    if (text.length > 40000) {
      store.setError('prompt_too_large');
      return false;
    }
    const id = store.updateComposerDraft(
      { text, editDesign: false, editCases: true, invoke: false },
      session.profileId,
      session.id,
    );
    if (!id) return false;
    store.setActiveId(id);
    return true;
  }
  async function reviseCases(run: WorkflowRun, value: CaseArtifact, reason: string) {
    let accepted = false;
    await tasks.perform(async (controller) => {
      const current = () => store.getSession(run.sessionId)?.runs.find((item) => item.id === run.id);
      if (current() !== run) throw new Error('approval_stale');
      const next = await reviseCaseSet(run, value, reason);
      if (controller.signal.aborted) throw new Error('execution_cancelled');
      if (current() !== run) throw new Error('approval_stale');
      store.updateRun(run.sessionId, next);
      accepted = true;
    }, run.sessionId);
    return accepted;
  }
  return { proposeCases: shared.propose, decideCaseProposal: shared.decide, prepareCaseRepair, reviseCases };
}
