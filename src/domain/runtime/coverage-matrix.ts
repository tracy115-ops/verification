import { isCases, isDesign, isRequirements } from './artifacts';
import { caseCoverageForRun } from './case-coverage';
import type { WorkflowRun } from './types';
import { scopedCases } from './case-scope';

export function coverageMatrix(run: WorkflowRun) {
  const artifacts = Object.values(run.artifacts);
  const pick = (confirmed: string, draft: string) =>
    (artifacts.find((item) => item.type === confirmed) ?? artifacts.find((item) => item.type === draft))
      ?.value;
  const baseline = pick('RequirementBaseline', 'RequirementBaselineDraft');
  const design = pick('TestDesign', 'TestDesignDraft');
  const rawCases = pick('TestCaseSet', 'TestCaseSetDraft');
  const casesGenerated = isCases(rawCases);
  const cases = casesGenerated ? scopedCases(run, rawCases).cases : [];
  const readCoverage = cases.length ? caseCoverageForRun(run) : undefined;
  const caseEntries = readCoverage ? cases.map((item) => ({ item, coverage: readCoverage(item) })) : [];
  const testDesign = isDesign(design) ? design : undefined;
  return (isRequirements(baseline) ? baseline.requirements : []).map((requirement) => {
    const factors = testDesign?.factors?.filter((item) => item.requirementIds.includes(requirement.id)) ?? [];
    const scenarios =
      testDesign?.scenarios.filter((item) => item.requirementIds.includes(requirement.id)) ?? [];
    const scenarioIds = new Set(scenarios.map((item) => item.id));
    const entries = caseEntries.filter(({ item }) => item.requirementIds.includes(requirement.id));
    const linked = entries.map(({ item }) => item);
    const indirectCases = cases.filter(
      (item) =>
        !item.requirementIds.includes(requirement.id) && item.scenarioIds.some((id) => scenarioIds.has(id)),
    );
    const states = entries.map(({ coverage }) => coverage);
    const declared = states.filter((item) => item.status === 'declared').length;
    const mapped = states.filter((item) => item.status === 'mapped').length;
    const passed = states.filter((item) => item.execution === 'passed').length;
    const failed = states.filter((item) => item.execution === 'failed').length;
    const notRun = states.filter((item) => item.execution === 'not_run').length;
    const skipped = states.filter((item) => item.execution === 'skipped').length;
    const gap = !scenarios.length || !linked.length || mapped !== linked.length;
    return {
      requirement,
      factors,
      scenarios,
      cases: linked,
      indirectCases,
      declared,
      mapped,
      passed,
      failed,
      notRun,
      skipped,
      gap,
      casesGenerated,
    };
  });
}
