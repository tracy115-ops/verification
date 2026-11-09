import { isCaseProposal } from './case-proposal-schema';
import { isDesignProposal } from './design-proposal-schema';
import { digest } from './plan';
import type { WorkflowRun } from './types';

export async function staleProposals(run: WorkflowRun, at: string, types: readonly string[]) {
  for (const [key, artifact] of Object.entries(run.artifacts)) {
    if (!types.includes(artifact.type)) continue;
    const previous = artifact.value;
    if (!(
      (artifact.type === 'DesignChangeProposal' && isDesignProposal(previous)) ||
      (artifact.type === 'CaseChangeProposal' && isCaseProposal(previous))
    ))
      continue;
    if (previous.status !== 'pending') continue;
    const value = { ...previous, status: 'stale', decidedAt: at };
    run.artifacts[key] = { ...artifact, value, digest: await digest(value) };
  }
}
