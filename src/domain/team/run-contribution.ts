import { isCases, isDesign, isRequirements } from '../runtime/artifacts.ts';
import { isEvidence, isExecutionPlan, isImplementation } from '../execution/schema.ts';
import type { WorkflowRun, CaseArtifact, DesignArtifact, RequirementArtifact } from '../runtime/types.ts';
import type { TeamProject } from './types.ts';
import type { CaseDefinition, ContributionInput, ContributionItem, ScriptInput } from './collaboration.ts';

export interface RunContribution {
  version: 1;
  kind: 'workflow-contribution';
  runId: string;
  spec: string;
  requirements: RequirementArtifact;
  design: DesignArtifact;
  cases: CaseArtifact;
}
export function runContribution(run: WorkflowRun): RunContribution | null {
  const artifacts = Object.values(run.artifacts);
  const choose = (type: string) => artifacts.find((item) => item.type === type)?.value;
  const requirements = choose('RequirementBaseline') ?? choose('RequirementBaselineDraft');
  const design = choose('TestDesign') ?? choose('TestDesignDraft');
  const cases = choose('TestCaseSet') ?? choose('TestCaseSetDraft');
  if (!isRequirements(requirements) || !isDesign(design) || !isCases(cases)) return null;
  return {
    version: 1,
    kind: 'workflow-contribution',
    runId: run.id,
    spec: run.spec,
    requirements,
    design,
    cases,
  };
}
function isRunContribution(value: unknown): value is RunContribution {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<RunContribution>;
  return (
    item.version === 1 &&
    item.kind === 'workflow-contribution' &&
    typeof item.runId === 'string' &&
    /^[a-f0-9-]{36}$/.test(item.runId) &&
    typeof item.spec === 'string' &&
    isRequirements(item.requirements) &&
    isDesign(item.design) &&
    isCases(item.cases)
  );
}
export function sharedId(runId: string, id: string) {
  return `R_${runId.slice(0, 8)}_${id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60)}`;
}
export function sharedCase(runId: string, item: CaseArtifact['cases'][number]): CaseDefinition {
  return {
    id: sharedId(runId, item.id),
    title: item.title,
    scenarioIds: item.scenarioIds.map((id) => sharedId(runId, id)),
    preconditions: item.preconditions,
    steps: item.steps,
    expected: item.expected,
    assertions: item.assertions,
    ownerId: '',
  };
}
export function importRunContribution(
  value: unknown,
  project: TeamProject,
  interfaceIds: string[],
  reason: string,
): ContributionInput {
  if (
    !isRunContribution(value) ||
    !interfaceIds.length ||
    interfaceIds.some((id) => !project.interfaces.some((item) => item.id === id))
  )
    throw new Error('team_invalid');
  const items: ContributionItem[] = [];
  for (const factor of value.design.factors ?? [])
    items.push({
      id: sharedId(value.runId, `I_F_${factor.id}`),
      kind: 'factor',
      action: 'add',
      reason,
      value: {
        id: sharedId(value.runId, factor.id),
        name: factor.name,
        levels: factor.levels,
        basis: factor.sourceQuote ? 'explicit' : 'hypothesis',
        sourceQuote: factor.sourceQuote,
        rationale: reason,
      },
    });
  for (const scenario of value.design.scenarios) {
    const quote =
      value.requirements.requirements.find((item) => scenario.requirementIds.includes(item.id))?.quote ?? '';
    items.push({
      id: sharedId(value.runId, `I_S_${scenario.id}`),
      kind: 'scenario',
      action: 'add',
      reason,
      value: {
        id: sharedId(value.runId, scenario.id),
        title: scenario.title,
        interfaceIds,
        oracle: scenario.expected,
        oracleBasis: quote ? 'contract' : 'unknown',
        sourceQuote: quote,
        factorValues: (scenario.factorLevels ?? []).map((item) => ({
          factorId: sharedId(value.runId, item.factorId),
          level: item.level,
        })),
        ownerId: '',
      },
    });
  }
  for (const item of value.cases.cases)
    items.push({
      id: sharedId(value.runId, `I_C_${item.id}`),
      kind: 'case',
      action: 'add',
      reason,
      value: sharedCase(value.runId, item),
    });
  return {
    version: 1,
    baseRevision: project.revision,
    source: { kind: 'agent', name: 'workflow', runId: value.runId },
    items,
  };
}
export function runScriptContribution(run: WorkflowRun): ScriptInput | null {
  const bundle = runContribution(run);
  if (!bundle) return null;
  const all = Object.values(run.artifacts).map((item) => item.value);
  const implementation = all.find((value) => isImplementation(value));
  const plan = all.find((value) => isExecutionPlan(value));
  const evidence = all.find((value) => isEvidence(value));
  if (!implementation) return null;
  const mappings = bundle.cases.cases
    .map((item) => ({
      caseId: sharedId(run.id, item.id),
      caseRevision: 1,
      testNames: implementation.tests
        .filter((test) => test.caseIds.includes(item.id))
        .map((test) => test.testName),
      definition: sharedCase(run.id, item),
    }))
    .filter((item) => item.testNames.length);
  return {
    version: 1,
    name: `test_${run.id.slice(0, 8)}.py`,
    source: implementation.script,
    mappings,
    ...(plan &&
    evidence &&
    plan.payload.implementation.script === implementation.script &&
    evidence.planDigest === plan.digest
      ? {
          execution: {
            runId: run.id,
            executionId: evidence.executionId,
            scriptSha256: plan.scriptSha256,
            evidenceDigest: evidence.resultSha256,
            results: evidence.results.map(({ testName, status }) => ({ testName, status })),
          },
        }
      : {}),
  };
}
