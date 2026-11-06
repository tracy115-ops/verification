import { isDesign } from './artifacts';
import type { StepState } from './types';

// Diagnostic metadata only: invalid designs never enter the artifact graph.
export function designMappingIssues(value: unknown): NonNullable<StepState['designMappingIssues']> {
  if (!isDesign(value)) return [];
  return value.scenarios
    .flatMap((scenario) =>
      (scenario.factorLevels ?? []).flatMap((link) => {
        const factor = value.factors?.find((item) => item.id === link.factorId);
        return factor && !factor.requirementIds.some((id) => scenario.requirementIds.includes(id))
          ? [{ scenarioId: scenario.id, factorId: factor.id, requirementIds: [...factor.requirementIds] }]
          : [];
      }),
    )
    .slice(0, 20);
}

export const designMappingInstruction =
  'Every scenario factorLevels link must use an existing factor ID and an exact level from that factor. The scenario requirementIds must overlap that factor requirementIds. If a factor does not apply to a scenario, omit that link or redesign the factor using source-backed requirements; never add an unrelated requirement merely to satisfy validation. Before returning, check every declared factor level against all scenario links. A fixed input or fixture precondition still needs an explicit applicable link; multiple fixed conditions may coexist in the same scenario. For genuinely uncovered levels report an in-scope gap instead of claiming completeness. Do not invent scenarios or remove levels just to hide missing coverage.';
