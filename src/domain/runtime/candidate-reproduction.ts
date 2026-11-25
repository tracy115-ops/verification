import { isReport } from '../execution/schema';
import { decodeImplementation } from '../execution/validation';
import { buildReport } from '../execution/report';
import { canonicalJson } from '../execution/canonical';
import { linkedExecution } from './execution-link';
import { candidateReviewReady, candidateReviews } from './candidate-review';
import { caseContext } from './case-revision';
import { sha256Text } from '../../shared/sha256';
import { frameworkSha256 } from '../execution/framework-modules';
import type { WorkflowRun } from './types';

/** Export a coherent executed suite. A selected candidate does not narrow the approved script. */
export async function candidateReproduction(initial: WorkflowRun, reportDigest: string, candidateId: string) {
  const run = structuredClone(initial);
  const artifact = Object.values(run.artifacts).find((item) => item.type === 'VerificationReport');
  if (
    !artifact ||
    !isReport(artifact.value) ||
    artifact.digest !== reportDigest ||
    !candidateReviewReady(run, reportDigest, candidateId)
  )
    throw new Error('candidate_reproduction_unavailable');
  const report = artifact.value;
  const candidate = report.candidates.find((item) => item.id === candidateId)!;
  const { implementation, plan, evidence } = linkedExecution(run);
  if (!implementation || !plan || !evidence) throw new Error('candidate_reproduction_unavailable');
  const source = caseContext(run);
  decodeImplementation(implementation, source.cases);
  const actual = buildReport(evidence, { candidates: report.candidates, notes: report.notes });
  const [scriptHash, frameworkHash] = await Promise.all([
    sha256Text(implementation.script),
    frameworkSha256(plan.payload.profile),
  ]);
  if (
    canonicalJson(actual.counts) !== canonicalJson(report.counts) ||
    scriptHash !== plan.scriptSha256 ||
    frameworkHash !== plan.frameworkSha256
  )
    throw new Error('candidate_reproduction_unavailable');
  return {
    formatVersion: 1 as const,
    kind: 'candidate-reproduction' as const,
    scope: 'approved-suite' as const,
    exportedAt: new Date().toISOString(),
    runId: run.id,
    sessionId: run.sessionId,
    reportDigest,
    candidate,
    source: { spec: run.spec, ...source },
    implementation,
    framework: plan.payload.profile,
    execution: {
      planDigest: plan.digest,
      executionId: evidence.executionId,
      scriptSha256: scriptHash,
      frameworkSha256: frameworkHash,
      pythonVersion: plan.pythonVersion,
      testNames: plan.testNames,
      evidence,
    },
    report,
    reviews: candidateReviews(run, reportDigest, candidateId),
  };
}
