import type { WorkflowRun } from '../domain/runtime/types';
import { isRequirements, parseArtifact } from '../domain/runtime/artifacts';
import { transcriptStore } from './transcript-store';
import { digest } from '../domain/runtime/plan';

export async function recoverRequirementDraft(run: WorkflowRun): Promise<WorkflowRun> {
  const node = run.plan.find((item) => item.operation === 'requirements.extract');
  if (
    !node ||
    !['source_quote_invalid', 'source_quote_ambiguous'].includes(run.steps[node.id].errorCode ?? '')
  )
    return run;
  const key = `${node.id}.${Object.keys(node.outputs)[0]}`;
  if (isRequirements(run.artifacts[key]?.value)) return run;
  if (run.steps[node.id].analysis) return run;
  await transcriptStore.load(run.sessionId);
  const turn = transcriptStore
    .getSnapshot()
    .records.find(
      (item) =>
        item.id === run.steps[node.id].turnId && item.runId === run.id && item.sessionId === run.sessionId,
    );
  if (!turn) return run;
  try {
    const value = parseArtifact(turn.text);
    if (!isRequirements(value)) return run;
    const next = structuredClone(run);
    next.artifacts[key] = { type: 'RequirementBaselineDraft', value, digest: await digest(value) };
    return next;
  } catch {
    return run;
  }
}
