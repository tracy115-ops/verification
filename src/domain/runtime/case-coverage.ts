import { linkedExecution } from './execution-link';
import { canonical } from '../team/collaboration';
import type { EvidenceBundle, ImplementationBundle } from '../execution/types';
import type { CaseArtifact, WorkflowRun } from './types';
import { latestArtifact } from './bindings';
import { isCases } from './artifacts';

export interface CoverageEvent {
  caseId: string;
  baseline: string;
  covered: boolean;
  note: string;
  at: string;
}
export function coverageEvents(run: WorkflowRun): CoverageEvent[] {
  const value = run.artifacts['coverage.declarations']?.value;
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('events' in value) ||
    !Array.isArray(value.events)
  )
    return [];
  return value.events.filter(
    (item): item is CoverageEvent =>
      !!item &&
      typeof item.caseId === 'string' &&
      typeof item.baseline === 'string' &&
      typeof item.covered === 'boolean' &&
      typeof item.note === 'string' &&
      typeof item.at === 'string' &&
      Number.isFinite(Date.parse(item.at)),
  );
}
type TestMapping = ImplementationBundle['tests'][number];

export function caseCoverageForRun(run: WorkflowRun) {
  const { implementation, plan, evidence } = linkedExecution(run);
  const approved = latestArtifact(run, 'TestCaseSet');
  const approvedCases = new Map(isCases(approved) ? approved.cases.map((item) => [item.id, item]) : []);
  const testsByCase = new Map<string, TestMapping[]>();
  for (const test of implementation?.tests ?? []) {
    for (const caseId of new Set(test.caseIds)) {
      const tests = testsByCase.get(caseId);
      if (tests) tests.push(test);
      else testsByCase.set(caseId, [test]);
    }
  }
  const claims = new Map(coverageEvents(run).map((event) => [event.caseId, event]));
  const plannedTests = new Set(plan?.testNames);
  const results = new Map(evidence?.results.map((result) => [result.testName, result.status]));

  return (item: CaseArtifact['cases'][number]) => {
    const baseline = canonical(item);
    const approvedCase = approvedCases.get(item.id);
    const tests =
      approvedCase && (approvedCase === item || canonical(approvedCase) === baseline)
        ? (testsByCase.get(item.id) ?? [])
        : [];
    return evaluateCoverage(baseline, tests, claims.get(item.id), plannedTests, results);
  };
}

function evaluateCoverage(
  baseline: string,
  tests: TestMapping[],
  claim: CoverageEvent | undefined,
  plannedTests: ReadonlySet<string>,
  results: ReadonlyMap<string, EvidenceBundle['results'][number]['status']>,
) {
  const mapped = !!tests.length && tests.every((test) => plannedTests.has(test.testName));
  const current = claim?.baseline === baseline;
  const status = mapped
    ? 'mapped'
    : tests.length || (current && claim?.covered)
      ? 'declared'
      : claim?.covered
        ? 'stale'
        : 'uncovered';
  const statuses = mapped ? tests.map((test) => results.get(test.testName) ?? 'not_run') : [];
  const execution = statuses.some((status) => status === 'failed' || status === 'error')
    ? 'failed'
    : !statuses.length || statuses.includes('not_run')
      ? 'not_run'
      : statuses.includes('skipped')
        ? 'skipped'
        : 'passed';
  return { status, execution, tests, claim, current } as const;
}

export function personalCoverage(run: WorkflowRun, item: CaseArtifact['cases'][number]) {
  return caseCoverageForRun(run)(item);
}
