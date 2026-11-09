import { isCases, isDesign, isRequirements } from './artifacts';
import { scopedCases } from './case-scope';
import type { WorkflowRun } from './types';

export type FindingState = 'open' | 'pending' | 'answered' | 'excluded';
export type FindingStage = 'review.requirements' | 'review.coverage' | 'review.cases';
export interface DesignFinding {
  kind: 'level' | 'scenario' | 'question' | 'gap' | 'requirement-scenarios' | 'requirement-cases';
  target: 'requirements' | 'factors' | 'scenarios';
  id: string;
  text: string;
  issue: string;
  stage: FindingStage;
  state: FindingState;
  reason?: string;
}

function finding(
  run: WorkflowRun,
  item: Omit<DesignFinding, 'state' | 'reason'>,
  pending = false,
): DesignFinding {
  const node = run.plan.find((node) => node.operation === item.stage);
  const answer =
    item.kind === 'question'
      ? run.clarifications?.find((entry) => entry.question === item.issue && entry.answer.trim())?.answer
      : undefined;
  const exclusion =
    node &&
    run.reviewExclusions?.find(
      (entry) => entry.nodeId === node.id && entry.issue === item.issue && entry.reason.trim(),
    );
  return {
    ...item,
    state: answer ? 'answered' : exclusion ? 'excluded' : pending ? 'pending' : 'open',
    reason: answer ?? exclusion?.reason,
  };
}

// Checks explicit links only, not semantic completeness or feasible combinations.
export function designQuality(run: WorkflowRun) {
  const artifacts = Object.values(run.artifacts);
  const pick = (confirmed: string, draft: string) =>
    (artifacts.find((item) => item.type === confirmed) ?? artifacts.find((item) => item.type === draft))
      ?.value;
  const baseline = pick('RequirementBaseline', 'RequirementBaselineDraft');
  const design = pick('TestDesign', 'TestDesignDraft');
  const rawCases = pick('TestCaseSet', 'TestCaseSetDraft');
  const cases = isCases(rawCases) ? scopedCases(run, rawCases) : undefined;
  const scenarioRequirements = new Set(
    isDesign(design) ? design.scenarios.flatMap((item) => item.requirementIds) : [],
  );
  const caseRequirements = new Set(cases?.cases.flatMap((item) => item.requirementIds) ?? []);
  const caseScenarios = new Set(cases?.cases.flatMap((item) => item.scenarioIds) ?? []);
  const scenarioLevels = new Set(
    isDesign(design)
      ? design.scenarios.flatMap((item) =>
          (item.factorLevels ?? []).map((link) => JSON.stringify([link.factorId, link.level])),
        )
      : [],
  );
  const findings: DesignFinding[] = [];
  let levels = 0;
  let coveredLevels = 0;
  let coveredScenarios = 0;
  if (isRequirements(baseline)) {
    for (const text of baseline.questions)
      findings.push(
        finding(run, {
          kind: 'question',
          stage: 'review.requirements',
          target: 'requirements',
          id: '',
          issue: text,
          text,
        }),
      );
    if (isDesign(design))
      for (const requirement of baseline.requirements) {
        if (!scenarioRequirements.has(requirement.id))
          findings.push(
            finding(run, {
              kind: 'requirement-scenarios',
              stage: 'review.coverage',
              target: 'requirements',
              id: requirement.id,
              issue: requirement.id,
              text: requirement.text,
            }),
          );
        if (cases && !caseRequirements.has(requirement.id))
          findings.push(
            finding(run, {
              kind: 'requirement-cases',
              stage: 'review.cases',
              target: 'requirements',
              id: requirement.id,
              issue: requirement.id,
              text: requirement.text,
            }),
          );
      }
  }
  if (isDesign(design)) {
    for (const factor of design.factors ?? []) {
      for (const level of factor.levels) {
        levels++;
        if (scenarioLevels.has(JSON.stringify([factor.id, level]))) coveredLevels++;
        else
          findings.push(
            finding(run, {
              kind: 'level',
              stage: 'review.coverage',
              target: 'factors',
              id: factor.id,
              issue: `${factor.id}: ${level}`,
              text: `${factor.name} · ${level}`,
            }),
          );
      }
    }
    for (const scenario of design.scenarios) {
      if (caseScenarios.has(scenario.id)) coveredScenarios++;
      else
        findings.push(
          finding(
            run,
            {
              kind: 'scenario',
              stage: 'review.cases',
              target: 'scenarios',
              id: scenario.id,
              issue: scenario.id,
              text: scenario.title,
            },
            !cases,
          ),
        );
    }
    for (const text of design.gaps)
      findings.push(
        finding(run, {
          kind: 'gap',
          stage: 'review.coverage',
          target: 'scenarios',
          id: '',
          issue: text,
          text,
        }),
      );
  }
  return {
    findings,
    levels,
    coveredLevels,
    coveredScenarios,
    scenarios: isDesign(design) ? design.scenarios.length : 0,
    casesGenerated: !!cases,
    designGenerated: isDesign(design),
    open: findings.filter((item) => item.state === 'open').length,
    pending: findings.filter((item) => item.state === 'pending').length,
    decided: findings.filter((item) => ['answered', 'excluded'].includes(item.state)).length,
  };
}
