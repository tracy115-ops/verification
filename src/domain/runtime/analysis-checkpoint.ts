import type { AgentProfile, WorkflowNode } from '../workflow';
import type { AnalysisCheckpoint, WorkflowRun } from './types';
import { digest } from './plan';
import { byteLength } from './analysis-plan';

export async function analysisCheckpoint(
  run: WorkflowRun,
  node: WorkflowNode,
  profile: AgentProfile,
  kind: AnalysisCheckpoint['kind'],
  total: number,
  localTotal: number,
  inputs: Record<string, unknown>,
) {
  const signature = await digest({
    version: 1,
    kind,
    spec: run.spec,
    node,
    profile,
    snapshot: run.snapshot,
    clarifications: run.clarifications,
    exclusions: run.reviewExclusions,
    inputs,
  });
  const previous = run.steps[node.id].analysis;
  if (previous && (previous.signature !== signature || previous.version !== 1 || previous.kind !== kind))
    throw new Error('approval_stale');
  const checkpoint: AnalysisCheckpoint = previous ?? {
    version: 1,
    signature,
    kind,
    total,
    localTotal,
    completed: [],
  };
  if (
    checkpoint.total !== total ||
    checkpoint.localTotal !== localTotal ||
    new Set(checkpoint.completed.map((item) => item.index)).size !== checkpoint.completed.length ||
    checkpoint.completed.some(
      (item) => !Number.isInteger(item.index) || item.index < 0 || item.index >= total,
    )
  )
    throw new Error('artifact_invalid');
  if (
    checkpoint.rejected &&
    (kind !== 'requirements' ||
      !Number.isInteger(checkpoint.rejected.index) ||
      checkpoint.rejected.index < 0 ||
      checkpoint.rejected.index >= total ||
      checkpoint.completed.some((item) => item.index === checkpoint.rejected!.index))
  )
    throw new Error('artifact_invalid');
  for (const saved of checkpoint.completed)
    if (saved.digest !== (await digest(saved.value))) throw new Error('artifact_invalid');
  run.steps[node.id].analysis = checkpoint;
  return checkpoint;
}

export async function saveAnalysisBatch(
  checkpoint: AnalysisCheckpoint,
  index: number,
  value: AnalysisCheckpoint['completed'][number]['value'],
) {
  const completed = [...checkpoint.completed, { index, value, digest: await digest(value) }];
  if (byteLength(JSON.stringify({ ...checkpoint, completed, rejected: undefined })) > 256_000)
    throw new Error('analysis_checkpoint_full');
  checkpoint.completed = completed;
}
