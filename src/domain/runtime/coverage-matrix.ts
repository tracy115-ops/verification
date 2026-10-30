import { isCases, isDesign, isRequirements } from './artifacts';
import { personalCoverage } from './case-coverage';
import type { WorkflowRun } from './types';

export function coverageMatrix(run: WorkflowRun) {
  const artifacts = Object.values(run.artifacts);
  const pick = (confirmed: string, draft: string) =>
    (artifacts.find((item) => item.type === confirmed) ?? artifacts.find((item) => item.type === draft))
      ?.value;
  const baseline = pick('RequirementBaseline', 'RequirementBaselineDraft');
  const design = pick('TestDesign', 'TestDesignDraft');
  const cases = pick('TestCaseSet', 'TestCaseSetDraft');
  return (isRequirements(baseline) ? baseline.requirements : []).map((requirement) => {
    const factors = isDesign(design)
      ? (design.factors ?? []).filter((item) => item.requirementIds.includes(requirement.id))
      : [];
    const scenarios = isDesign(design)
      ? design.scenarios.filter((item) => item.requirementIds.includes(requirement.id))
      : [];
    const scenarioIds = new Set(scenarios.map((item) => item.id));
    const linked = isCases(cases)
      ? cases.cases.filter(
          (item) =>
            item.requirementIds.includes(requirement.id) ||
            item.scenarioIds.some((id) => scenarioIds.has(id)),
        )
      : [];
    const states = linked.map((item) => personalCoverage(run, item));
    const declared = states.filter((item) => item.status === 'declared').length;
    const mapped = states.filter((item) => item.status === 'mapped').length;
    const passed = states.filter((item) => item.execution === 'passed').length;
    const failed = states.filter((item) => item.execution === 'failed').length;
    const gap = !factors.length || !scenarios.length || !linked.length || mapped !== linked.length;
    return { requirement, factors, scenarios, cases: linked, declared, mapped, passed, failed, gap };
  });
}
