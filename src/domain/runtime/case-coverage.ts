import { isEvidence, isExecutionPlan, isImplementation } from '../execution/schema';
import { canonical } from '../team/collaboration';
import type { CaseArtifact, WorkflowRun } from './types';

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
export function personalCoverage(run: WorkflowRun, item: CaseArtifact['cases'][number]) {
  const all = Object.values(run.artifacts).map((artifact) => artifact.value);
  const implementation = all.find((value) => isImplementation(value));
  const plan = all.find((value) => isExecutionPlan(value));
  const evidence = all.find((value) => isEvidence(value));
  const tests = implementation?.tests.filter((test) => test.caseIds.includes(item.id)) ?? [];
  const mapped =
    !!tests.length &&
    !!plan &&
    plan.payload.implementation.script === implementation?.script &&
    tests.every((test) => plan.testNames.includes(test.testName));
  const claim = coverageEvents(run)
    .filter((event) => event.caseId === item.id)
    .at(-1);
  const current = claim?.baseline === canonical(item);
  const status = mapped
    ? 'mapped'
    : tests.length || (current && claim?.covered)
      ? 'declared'
      : claim?.covered
        ? 'stale'
        : 'uncovered';
  const results =
    mapped && evidence?.planDigest === plan?.digest
      ? tests.map(
          (test) => evidence.results.find((result) => result.testName === test.testName)?.status ?? 'not_run',
        )
      : [];
  const execution = results.some((status) => status === 'failed' || status === 'error')
    ? 'failed'
    : !results.length || results.includes('not_run')
      ? 'not_run'
      : results.includes('skipped')
        ? 'skipped'
        : 'passed';
  return { status, execution, tests, claim, current } as const;
}
