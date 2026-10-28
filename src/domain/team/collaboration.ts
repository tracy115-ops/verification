import type { ScenarioReview, TeamProject, TeamScenario, TestFactor } from './types.ts';

export interface CaseDefinition {
  id: string;
  title: string;
  scenarioIds: string[];
  preconditions: string[];
  steps: string[];
  expected: string;
  assertions: string[];
  ownerId: string;
}
export interface SharedCase extends CaseDefinition {
  revision: number;
  review?: ScenarioReview;
  declaration?: { by: string; at: string; note: string; caseRevision: number };
}
export type Change =
  | { kind: 'factor'; value: TestFactor }
  | { kind: 'scenario'; value: Omit<TeamScenario, 'review'> }
  | { kind: 'case'; value: CaseDefinition };
export type ContributionItem = Change & { id: string; action: 'add' | 'update'; reason: string };
export interface ContributionInput {
  version: 1;
  baseRevision: number;
  source: { kind: 'human' | 'agent'; name: string; runId: string };
  items: ContributionItem[];
}
export type ProposalItem = ContributionItem & {
  before: unknown;
  status: 'pending' | 'accepted' | 'rejected';
  resolution?: { by: string; at: string; comment: string; applied?: Change };
};
export interface Contribution extends Omit<ContributionInput, 'items'> {
  id: string;
  by: string;
  at: string;
  items: ProposalItem[];
}
export interface ScriptInput {
  version: 1;
  name: string;
  source: string;
  mappings: { caseId: string; caseRevision: number; testNames: string[]; definition?: CaseDefinition }[];
  execution?: {
    runId: string;
    executionId: string;
    scriptSha256: string;
    evidenceDigest: string;
    results: { testName: string; status: 'passed' | 'failed' | 'error' | 'skipped' }[];
  };
}
export interface SharedScript extends ScriptInput {
  id: string;
  sha256: string;
  methods: string[];
  by: string;
  at: string;
}
export interface Collaboration {
  version: 1;
  cases: SharedCase[];
  contributions: Contribution[];
  scripts: SharedScript[];
}
export type CollaborationCommand =
  | { type: 'propose'; proposal: ContributionInput }
  | {
      type: 'resolve_proposal';
      proposalId: string;
      itemId: string;
      decision: 'accepted' | 'rejected';
      comment: string;
      applied?: Change;
    }
  | { type: 'upsert_case'; value: CaseDefinition; caseRevision: number }
  | {
      type: 'review_case';
      caseId: string;
      caseRevision: number;
      decision: 'accepted' | 'needs_changes';
      comment: string;
    }
  | { type: 'declare_coverage'; caseId: string; caseRevision: number; covered: boolean; note: string };

export function collaboration(project: TeamProject): Collaboration {
  return project.collaboration ?? { version: 1, cases: [], contributions: [], scripts: [] };
}
export function definition(project: TeamProject, kind: Change['kind'], id: string): unknown {
  if (kind === 'factor') return project.factors.find((item) => item.id === id) ?? null;
  if (kind === 'scenario') {
    const scenario = project.scenarios.find((item) => item.id === id);
    if (!scenario) return null;
    const { review: _, ...value } = scenario;
    return value;
  }
  const item = collaboration(project).cases.find((item) => item.id === id);
  if (!item) return null;
  const { revision: _, review: _review, declaration: _claim, ...value } = item;
  return { ...value, revision: item.revision };
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export function invalidateCases(project: TeamProject, scenarioIds: string[]) {
  for (const item of collaboration(project).cases)
    if (item.scenarioIds.some((id) => scenarioIds.includes(id))) {
      item.revision++;
      delete item.review;
    }
}
export function caseIssues(project: TeamProject, item: CaseDefinition): string[] {
  const issues: string[] = [];
  if (!item.steps.length || !item.assertions.length || !item.expected.trim())
    issues.push('collab_case_incomplete');
  if (
    !item.scenarioIds.length ||
    item.scenarioIds.some(
      (id) => project.scenarios.find((scenario) => scenario.id === id)?.review?.decision !== 'accepted',
    )
  )
    issues.push('collab_scenario_unreviewed');
  if (!item.ownerId) issues.push('team_missing_owner');
  return issues;
}
export function scriptCoverage(project: TeamProject, item: SharedCase) {
  const history = collaboration(project).scripts.flatMap((script) =>
    script.mappings.filter((mapping) => mapping.caseId === item.id).map((mapping) => ({ script, mapping })),
  );
  const latest = new Map<string, SharedScript>();
  for (const script of collaboration(project).scripts) latest.set(script.name, script);
  const linked = [...latest.values()].flatMap((script) =>
    script.mappings.filter((mapping) => mapping.caseId === item.id).map((mapping) => ({ script, mapping })),
  );
  const current = linked.filter(({ mapping }) => mapping.caseRevision === item.revision);
  const status = current.length
    ? 'mapped'
    : item.declaration?.caseRevision === item.revision
      ? 'declared'
      : history.length || item.declaration
        ? 'stale'
        : 'uncovered';
  const results = current.flatMap(({ script, mapping }) =>
    mapping.testNames.map(
      (name) => script.execution?.results.find((result) => result.testName === name)?.status ?? 'not_run',
    ),
  );
  const execution = results.some((result) => ['failed', 'error'].includes(result))
    ? 'failed'
    : !results.length || results.includes('not_run')
      ? 'not_run'
      : results.includes('skipped')
        ? 'skipped'
        : 'passed';
  return {
    status,
    execution,
    current,
    stale: current.length ? linked.filter(({ mapping }) => mapping.caseRevision !== item.revision) : history,
  } as const;
}
