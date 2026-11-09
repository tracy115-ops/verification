import { decodeCases, decodeDesign, decodeRequirements } from './artifacts';
import { latestArtifact } from './bindings';
import { reviewDigest } from './approvals';
import { digest } from './plan';
import { descendants } from './descendants';
import { pauseForReview } from './deadline';
import type { CaseArtifact, WorkflowRun } from './types';
import { staleProposals } from './stale-proposals';
import { canonicalJson } from '../execution/canonical';

export function caseContext(run: WorkflowRun) {
  const requirements = decodeRequirements(latestArtifact(run, 'RequirementBaseline'), run.spec);
  const design = decodeDesign(latestArtifact(run, 'TestDesign'), requirements);
  const value = latestArtifact(run, 'TestCaseSet') ?? latestArtifact(run, 'TestCaseSetDraft');
  return structuredClone({ requirements, design, cases: decodeCases(value, requirements, design) });
}

export async function reviseCases(
  initial: WorkflowRun,
  value: CaseArtifact,
  reason: string,
  attribution?: { proposalId: string; turnId: string },
) {
  if (['ready', 'running'].includes(initial.status) || !reason.trim() || reason.trim().length > 12000)
    throw new Error('approval_invalid');
  const { requirements, design, cases } = caseContext(initial);
  decodeCases(value, requirements, design);
  if (canonicalJson(cases) === canonicalJson(value)) throw new Error('case_proposal_empty');
  const review = initial.plan.find((node) => node.operation === 'review.cases');
  const producer = initial.plan.find((node) => node.operation === 'cases.generate');
  if (!review || !producer || initial.steps[producer.id]?.status !== 'succeeded')
    throw new Error('approval_invalid');
  const run = structuredClone(initial);
  const affected = descendants(run.plan, [review.id]);
  const revisions = Object.values(run.artifacts).filter((item) => item.type === 'CaseRevision');
  const archive = {
    version: 1,
    source: attribution ? 'agent_approved' : 'human',
    ...(attribution ? { attribution } : {}),
    reason: reason.trim(),
    at: new Date().toISOString(),
    createdAt: initial.createdAt,
    status: initial.status,
    artifacts: Object.fromEntries(
      Object.entries(initial.artifacts).filter(
        ([, item]) => !['DesignRevision', 'CaseRevision', 'ImplementationRevision'].includes(item.type),
      ),
    ),
    steps: initial.steps,
    approvals: initial.approvals,
    reviewExclusions: initial.reviewExclusions ?? [],
  };
  run.artifacts[`history.cases.${revisions.length + 1}`] = {
    type: 'CaseRevision',
    value: archive,
    digest: await digest(archive),
  };
  await staleProposals(run, archive.at, ['CaseChangeProposal']);
  for (const node of run.plan) {
    if (!affected.has(node.id)) continue;
    run.steps[node.id] = { status: 'pending', attempts: 0 };
    for (const slot of Object.keys(node.outputs)) delete run.artifacts[`${node.id}.${slot}`];
  }
  delete run.artifacts['coverage.declarations'];
  delete run.artifacts['implementation.clarifications'];
  run.artifacts[`${producer.id}.${Object.keys(producer.outputs)[0]}`] = {
    type: 'TestCaseSetDraft',
    value: structuredClone(value),
    digest: await digest(value),
  };
  run.approvals = run.approvals.filter((item) => !affected.has(item.nodeId));
  run.reviewExclusions = run.reviewExclusions?.filter((item) => !affected.has(item.nodeId));
  run.createdAt = archive.at;
  delete run.resumedAt;
  delete run.reviewWaitMs;
  delete run.errorCode;
  run.status = 'awaiting_review';
  pauseForReview(run);
  run.steps[review.id] = {
    status: 'awaiting_review',
    attempts: 0,
    reviewDigest: await reviewDigest(run, review),
  };
  return run;
}
