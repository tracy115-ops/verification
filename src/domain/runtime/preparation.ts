import { checkDocument, type AgentProfile, type WorkbenchDocument } from '../workflow';
import type { FrameworkProfile } from '../execution/types';
import type { ComposerDraft } from './composer-draft';
import { decodeFramework } from '../execution/validation';
import { nativeAgentFields } from './profile';
import { selectRunPlan } from './plan';
import { workflowCommand } from './chat';

export interface PreparationIssue {
  code: string;
  profileId?: string;
}
export interface PreparedAgent {
  id: string;
  profile?: AgentProfile;
  nodeIds: string[];
  error?: string;
}
export interface WorkflowPreparation {
  revision?: number;
  stepCount: number;
  agents: PreparedAgent[];
  framework?: FrameworkProfile;
  execution?: boolean;
  issues: PreparationIssue[];
}

export function prepareInvocation(
  draft: ComposerDraft,
  saved: WorkbenchDocument | null,
  profiles: AgentProfile[],
  frameworks: FrameworkProfile[],
): WorkflowPreparation | undefined {
  if (draft.editDesign || draft.editCases) return;
  let command;
  try {
    command = workflowCommand(draft.text, saved?.definition.id);
  } catch {
    return { stepCount: 0, agents: [], issues: [{ code: 'workflow_not_found' }] };
  }
  if (!draft.invoke && !command.invoke) return;
  const result: WorkflowPreparation = { revision: saved?.revision, stepCount: 0, agents: [], issues: [] };
  if (!saved) {
    result.issues.push({ code: 'workflow_not_saved' });
    return result;
  }
  const snapshot = draft.useNodeBindings ? saved : { ...saved, bindings: {} };
  if (saved.revision < 1 || checkDocument(snapshot).length) {
    result.issues.push({ code: 'invalid_run' });
    return result;
  }
  if (!command.spec.trim()) result.issues.push({ code: 'preparation_spec_missing' });
  if (command.spec.length > 40000) result.issues.push({ code: 'prompt_too_large' });
  const execution = draft.invoke && !!draft.frameworkId;
  result.execution = execution;
  if (execution) {
    const framework = frameworks.find((item) => item.id === draft.frameworkId);
    if (!framework) result.issues.push({ code: 'execution_invalid' });
    else {
      try {
        result.framework = decodeFramework(framework);
      } catch (error) {
        result.issues.push({ code: error instanceof Error ? error.message : 'execution_invalid' });
      }
    }
  }
  try {
    const plan = selectRunPlan(snapshot, execution);
    result.stepCount = plan.length;
    for (const node of plan.filter((item) => item.role)) {
      const id = snapshot.bindings[node.id] ?? draft.profileId;
      let agent = result.agents.find((item) => item.id === id);
      if (!agent) {
        const profile = profiles.find((item) => item.id === id);
        agent = { id, profile, nodeIds: [] };
        try {
          if (!profile) throw new Error('profile_missing');
          nativeAgentFields(profile);
        } catch (error) {
          agent.error = error instanceof Error ? error.message : 'unsupported_profile';
          result.issues.push({ code: agent.error, profileId: id });
        }
        result.agents.push(agent);
      }
      agent.nodeIds.push(node.id);
    }
  } catch (error) {
    result.issues.push({ code: error instanceof Error ? error.message : 'unsupported_workflow' });
  }
  if (
    !profiles.some((profile) => profile.id === draft.profileId) &&
    !result.issues.some((issue) => issue.code === 'profile_missing' && issue.profileId === draft.profileId)
  ) {
    result.issues.push({ code: 'profile_missing', profileId: draft.profileId });
  }
  return result;
}
