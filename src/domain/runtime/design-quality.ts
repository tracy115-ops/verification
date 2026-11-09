import { isCases, isDesign, isRequirements } from './artifacts';
import type { WorkflowRun } from './types';

export interface DesignFinding {
  kind: 'level' | 'scenario' | 'question' | 'gap';
  target: 'requirements' | 'factors' | 'scenarios';
  id: string;
  text: string;
}

// Structural findings are reproducible. They do not certify semantic coverage,
// feasible combinations, or whether the specification itself is complete.
export function designQuality(run: WorkflowRun) {
  const artifacts = Object.values(run.artifacts);
  const pick = (confirmed: string, draft: string) =>
    (artifacts.find((item) => item.type === confirmed) ?? artifacts.find((item) => item.type === draft))
      ?.value;
  const baseline = pick('RequirementBaseline', 'RequirementBaselineDraft');
  const design = pick('TestDesign', 'TestDesignDraft');
  const cases = pick('TestCaseSet', 'TestCaseSetDraft');
  const findings: DesignFinding[] = [];
  let levels = 0;
  let coveredLevels = 0;
  let coveredScenarios = 0;
  if (isRequirements(baseline)) {
    for (const text of baseline.questions)
      findings.push({ kind: 'question', target: 'requirements', id: '', text });
  }
  if (isDesign(design)) {
    for (const factor of design.factors ?? []) {
      for (const level of factor.levels) {
        levels++;
        if (
          design.scenarios.some((scenario) =>
            scenario.factorLevels?.some((item) => item.factorId === factor.id && item.level === level),
          )
        )
          coveredLevels++;
        else
          findings.push({
            kind: 'level',
            target: 'factors',
            id: factor.id,
            text: `${factor.name} · ${level}`,
          });
      }
    }
    for (const scenario of design.scenarios) {
      if (isCases(cases) && cases.cases.some((item) => item.scenarioIds.includes(scenario.id)))
        coveredScenarios++;
      else findings.push({ kind: 'scenario', target: 'scenarios', id: scenario.id, text: scenario.title });
    }
    for (const text of design.gaps) findings.push({ kind: 'gap', target: 'scenarios', id: '', text });
  }
  return {
    findings,
    levels,
    coveredLevels,
    coveredScenarios,
    scenarios: isDesign(design) ? design.scenarios.length : 0,
    casesGenerated: isCases(cases),
  };
}
