import { decodeDesign, decodeRequirements } from './artifacts';
import { latestArtifact } from './bindings';
import { reviewDigest } from './approvals';
import { digest } from './plan';
import type { DesignArtifact, WorkflowRun } from './types';
import { pauseForReview } from './deadline';
import { descendants } from './descendants';
import { isDesignProposal } from './design-proposal-schema';

/** Reopen the coverage gate; never reuse downstream approvals or execution evidence. */
export async function reviseDesign(
  initial: WorkflowRun,
  value: DesignArtifact,
  reason: string,
  attribution?: { proposalId: string; turnId: string },
) {
  if (['ready', 'running'].includes(initial.status) || !reason.trim()) throw new Error('approval_invalid');
  const requirements = decodeRequirements(latestArtifact(initial, 'RequirementBaseline'), initial.spec);
  decodeDesign(value, requirements);
  const review = initial.plan.find((node) => node.operation === 'review.coverage');
  const producer = initial.plan.find((node) => node.operation === 'scenarios.design');
  if (!review || !producer || initial.steps[producer.id]?.status !== 'succeeded')
    throw new Error('approval_invalid');
  const revisions = Object.values(initial.artifacts).filter((item) => item.type === 'DesignRevision');
  const run = structuredClone(initial);
  const affected = descendants(run.plan, [review.id]);
  const archive = {
    version: 1,
    source: attribution ? 'agent_approved' : 'human',
    ...(attribution ? { attribution } : {}),
    reason: reason.trim(),
    at: new Date().toISOString(),
    createdAt: initial.createdAt,
    status: initial.status,
    artifacts: Object.fromEntries(
      Object.entries(initial.artifacts).filter(([, item]) => item.type !== 'DesignRevision'),
    ),
    steps: initial.steps,
    approvals: initial.approvals,
    reviewExclusions: initial.reviewExclusions ?? [],
  };
  run.artifacts[`history.design.${revisions.length + 1}`] = {
    type: 'DesignRevision',
    value: archive,
    digest: await digest(archive),
  };
  for (const [key, artifact] of Object.entries(run.artifacts)) {
    if (
      artifact.type !== 'DesignChangeProposal' ||
      !isDesignProposal(artifact.value) ||
      artifact.value.status !== 'pending'
    )
      continue;
    const value = { ...artifact.value, status: 'stale', decidedAt: archive.at };
    run.artifacts[key] = { ...artifact, value, digest: await digest(value) };
  }
  for (const node of run.plan) {
    if (!affected.has(node.id)) continue;
    run.steps[node.id] = { status: 'pending', attempts: 0 };
    for (const slot of Object.keys(node.outputs)) delete run.artifacts[`${node.id}.${slot}`];
  }
  delete run.artifacts['coverage.declarations'];
  delete run.artifacts['implementation.clarifications'];
  const slot = Object.keys(producer.outputs)[0];
  run.artifacts[`${producer.id}.${slot}`] = {
    type: 'TestDesignDraft',
    value: structuredClone(value),
    digest: await digest(value),
  };
  run.approvals = run.approvals.filter((item) => !affected.has(item.nodeId));
  run.reviewExclusions = run.reviewExclusions?.filter((item) => !affected.has(item.nodeId));
  run.createdAt = archive.at;
  delete run.resumedAt;
  delete run.reviewWaitMs;
  run.status = 'awaiting_review';
  pauseForReview(run);
  delete run.errorCode;
  run.steps[review.id] = {
    status: 'awaiting_review',
    attempts: 0,
    reviewDigest: await reviewDigest(run, review),
  };
  return run;
}
