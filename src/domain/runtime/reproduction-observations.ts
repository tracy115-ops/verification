import type { WorkflowRun } from './types';
import { reproductionSource } from './reproduction-source';
import { linkedExecution } from './execution-link';
import { canonicalJson } from '../execution/canonical';

export function reproductionObservations(run: WorkflowRun, siblings: WorkflowRun[]) {
  const source = reproductionSource(run);
  if (!source) return [];
  const current = linkedExecution(run).plan;
  const signature = (value: typeof source) =>
    canonicalJson({
      sourceRunId: value.sourceRunId,
      planDigest: value.planDigest,
      reportDigest: value.reportDigest,
      evidenceDigest: value.evidenceDigest,
      candidateId: value.candidateId,
      testNames: value.testNames,
      scriptSha256: value.scriptSha256,
      frameworkSha256: value.frameworkSha256,
      targetUrl: value.targetUrl,
    });
  const compatible = siblings.filter((item) => {
    const other = reproductionSource(item);
    return item.sessionId === run.sessionId && other && signature(other) === signature(source);
  });
  const currentProfile = current && canonicalJson(current.payload.profile);
  const observations = compatible.flatMap((trial) => {
    const { plan, evidence } = linkedExecution(trial);
    if (
      !current ||
      !plan ||
      !evidence ||
      plan.scriptSha256 !== source.scriptSha256 ||
      plan.frameworkSha256 !== source.frameworkSha256 ||
      plan.payload.profile.targetUrl !== source.targetUrl ||
      plan.pythonVersion !== current.pythonVersion ||
      canonicalJson(plan.payload.profile) !== currentProfile
    )
      return [];
    return [new Map(evidence.results.map((item) => [item.testName, item.status] as const))];
  });
  return source.testNames.map((testName) => {
    const counts = { passed: 0, failed: 0, error: 0, skipped: 0 };
    for (const observation of observations) {
      const status = observation.get(testName);
      if (status) counts[status]++;
    }
    const status =
      counts.error || counts.skipped
        ? 'inconclusive'
        : counts.failed && counts.passed
          ? 'intermittent'
          : counts.failed > 1
            ? 'repeated_failure'
            : counts.failed
              ? 'observed_failure'
              : counts.passed
                ? 'not_reproduced'
                : 'not_run';
    return { testName, counts, status };
  });
}
