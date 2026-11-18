import type { WorkflowRun } from '../domain/runtime/types';
import { decodeRequirements, parseArtifact } from '../domain/runtime/artifacts';
import { latestArtifact } from '../domain/runtime/bindings';
import { designQuoteIssues } from '../domain/runtime/design-source-quotes';
import { transcriptStore } from './transcript-store';

export async function recoverDesignDiagnostics(run: WorkflowRun): Promise<WorkflowRun> {
  const node = run.plan.find(
    (item) => item.operation === 'scenarios.design' && run.steps[item.id].status === 'failed',
  );
  if (
    !node ||
    run.steps[node.id].analysis ||
    run.steps[node.id].designQuoteIssues?.length ||
    !['artifact_invalid', 'design_factor_quote_invalid'].includes(run.steps[node.id].errorCode ?? '')
  )
    return run;
  await transcriptStore.load(run.sessionId);
  const turn = transcriptStore
    .getSnapshot()
    .records.find(
      (item) =>
        item.id === run.steps[node.id].turnId &&
        item.runId === run.id &&
        item.sessionId === run.sessionId &&
        item.nodeId === node.id &&
        item.operation === node.operation &&
        item.status === 'completed',
    );
  if (!turn) return run;
  try {
    const baseline = decodeRequirements(latestArtifact(run, 'RequirementBaseline'), run.spec);
    const issues = designQuoteIssues(parseArtifact(turn.text), baseline);
    if (!issues.length) return run;
    const next = structuredClone(run);
    next.steps[node.id].designQuoteIssues = issues;
    return next;
  } catch {
    return run;
  }
}
