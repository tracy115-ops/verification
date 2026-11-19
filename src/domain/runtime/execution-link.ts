import { isImplementation } from '../execution/schema';
import { canonicalJson } from '../execution/canonical';
import { decodeEvidence, decodePlan } from '../execution/validation';
import type { EvidenceBundle, ExecutionPlan } from '../execution/types';
import type { WorkflowRun } from './types';
import { latestArtifact } from './bindings';

/** Use current run artifacts only; archived or mismatched execution cannot establish coverage. */
export function linkedExecution(run: WorkflowRun) {
  const value = latestArtifact(run, 'ImplementationBundle');
  const implementation = isImplementation(value) ? value : undefined;
  let plan: ExecutionPlan | undefined;
  let evidence: EvidenceBundle | undefined;
  if (implementation) {
    try {
      const candidate = decodePlan(latestArtifact(run, 'ExecutionPlan'));
      if (
        candidate.payload.runId === run.id &&
        candidate.payload.sessionId === run.sessionId &&
        canonicalJson(candidate.payload.implementation) === canonicalJson(implementation)
      )
        plan = candidate;
    } catch {
      // Incomplete or restored artifacts remain unverified until preflight runs again.
    }
  }
  if (plan) {
    try {
      evidence = decodeEvidence(latestArtifact(run, 'EvidenceBundle'), plan);
    } catch {
      // Keep valid method mappings visible while requiring fresh execution evidence.
    }
  }
  return { implementation, plan, evidence };
}
