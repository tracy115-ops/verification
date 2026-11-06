import type { WorkflowRun } from './types';
import type { EvidenceBundle, VerificationReport } from '../execution/types';
import { isEvidence, isExecutionPlan } from '../execution/schema';
import { isCases, isRequirements } from './artifacts';

export function requestsForTest(evidence: EvidenceBundle, testName: string): unknown[] {
  if (!testName) return [];
  return evidence.requests.filter((item) => {
    if (!item || typeof item !== 'object' || !('test' in item) || typeof item.test !== 'string') return false;
    return item.test === testName || item.test.endsWith(`.${testName}`);
  });
}

/** Bind a report to its original evidence and plan. Never fall back to another run's results. */
export function candidateTrace(run: WorkflowRun, report: VerificationReport, candidateId: string) {
  const candidate = report.candidates.find((item) => item.id === candidateId);
  if (!candidate) return undefined;
  const all = Object.values(run.artifacts);
  const evidence = all
    .map((item) => item.value)
    .find((value) => isEvidence(value) && value.resultSha256 === report.evidenceDigest);
  if (!isEvidence(evidence)) return undefined;
  const plan = all
    .map((item) => item.value)
    .find((value) => isExecutionPlan(value) && value.digest === evidence.planDigest);
  if (
    !isExecutionPlan(plan) ||
    plan.payload.executionId !== evidence.executionId ||
    plan.payload.runId !== run.id ||
    plan.payload.sessionId !== run.sessionId
  )
    return undefined;
  const cases = all
    .filter((item) => item.type === 'TestCaseSet')
    .map((item) => item.value)
    .find((value) => isCases(value));
  const requirements = all
    .filter((item) => item.type === 'RequirementBaseline')
    .map((item) => item.value)
    .find((value) => isRequirements(value));
  const testNames = new Set(candidate.testNames);
  const mappedIds = new Set(
    plan.payload.implementation.tests
      .filter((item) => testNames.has(item.testName))
      .flatMap((item) => item.caseIds),
  );
  const linkedCases = (cases?.cases ?? []).filter(
    (item) => candidate.caseIds.includes(item.id) && mappedIds.has(item.id),
  );
  const requirementIds = new Set(linkedCases.flatMap((item) => item.requirementIds));
  const tests = candidate.testNames.map((testName) => ({
    testName,
    result: evidence.results.find((item) => item.testName === testName),
    requests: requestsForTest(evidence, testName),
  }));
  return {
    candidate,
    evidence,
    plan,
    tests,
    cases: linkedCases,
    requirements: (requirements?.requirements ?? []).filter((item) => requirementIds.has(item.id)),
    incomplete:
      tests.some((item) => !item.result) ||
      candidate.caseIds.some((id) => !linkedCases.some((item) => item.id === id)) ||
      [...requirementIds].some((id) => !requirements?.requirements.some((item) => item.id === id)),
  };
}
