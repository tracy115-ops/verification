import { isAnalysis, isProject, isProjectInput } from './schema.ts';
import type { ProjectInput, TeamAnalysis, TeamProject, TeamScenario } from './types.ts';
import { checkCollaboration } from './collaboration-rules.ts';

function fail(condition: boolean, code = 'team_invalid') {
  if (!condition) throw new Error(code);
}
const unique = (ids: string[]) => new Set(ids).size === ids.length;
export const sourceText = (project: Pick<ProjectInput, 'topic' | 'interfaces'>) =>
  [project.topic, ...project.interfaces.map((item) => item.contract)].join('\n\n');

export function checkAnalysis(analysis: TeamAnalysis, project: ProjectInput): void {
  fail(
    isAnalysis({
      factors: analysis.factors,
      questions: analysis.questions,
      scenarios: analysis.scenarios.map(({ review: _review, ...rest }: TeamScenario) => rest),
    }),
  );
  fail(unique(analysis.factors.map((item) => item.id)) && unique(analysis.scenarios.map((item) => item.id)));
  const source = sourceText(project);
  const factors = new Map(analysis.factors.map((factor) => [factor.id, factor]));
  const interfaces = new Set(project.interfaces.map((item) => item.id));
  for (const factor of analysis.factors) {
    fail(
      factor.basis !== 'explicit' || (!!factor.sourceQuote.trim() && source.includes(factor.sourceQuote)),
      'team_source_invalid',
    );
  }
  for (const scenario of analysis.scenarios) {
    fail(scenario.interfaceIds.every((id) => interfaces.has(id)));
    fail(unique(scenario.factorValues.map((item) => item.factorId)));
    fail(
      scenario.factorValues.every((item) => factors.get(item.factorId)?.levels.includes(item.level) === true),
    );
    fail(!scenario.sourceQuote || source.includes(scenario.sourceQuote), 'team_source_invalid');
  }
}
export function decodeProject(value: unknown): TeamProject {
  fail(isProject(value));
  if (!isProject(value)) throw new Error('team_invalid');
  fail(
    isProjectInput({
      title: value.title,
      mode: value.mode,
      locale: value.locale,
      topic: value.topic,
      interfaces: value.interfaces,
    }),
  );
  fail(unique(value.interfaces.map((item) => item.id)));
  checkAnalysis(value, value);
  checkCollaboration(value);
  return structuredClone(value);
}
export function readiness(scenario: TeamScenario, project: TeamProject): string[] {
  const issues: string[] = [];
  if (!scenario.oracle.trim() || scenario.oracleBasis === 'unknown') issues.push('team_missing_oracle');
  if (project.interfaces.length && !scenario.interfaceIds.length) issues.push('team_missing_interface');
  if (!scenario.factorValues.length) issues.push('team_missing_factors');
  if (
    scenario.oracleBasis === 'contract' &&
    (!scenario.sourceQuote.trim() || !sourceText(project).includes(scenario.sourceQuote))
  )
    issues.push('team_source_invalid');
  if (!scenario.ownerId) issues.push('team_missing_owner');
  return issues;
}
export function factorCoverage(project: TeamProject, factorId: string) {
  const factor = project.factors.find((item) => item.id === factorId);
  const covered = new Set(
    project.scenarios
      .filter((item) => item.review?.decision === 'accepted')
      .flatMap((item) =>
        item.factorValues.filter((value) => value.factorId === factorId).map((value) => value.level),
      ),
  );
  return { covered: covered.size, total: factor?.levels.length ?? 0 };
}
