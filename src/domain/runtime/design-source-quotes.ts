import { isDesign, matchingFactorQuote } from './artifacts';
import type { RequirementArtifact, StepState } from './types';

export function designQuoteIssues(
  value: unknown,
  baseline: RequirementArtifact,
): NonNullable<StepState['designQuoteIssues']> {
  if (!isDesign(value)) return [];
  const ids = new Set(baseline.requirements.map((item) => item.id));
  if (new Set(value.factors?.map((factor) => factor.id)).size !== value.factors?.length) return [];
  return (value.factors ?? [])
    .filter(
      (factor) =>
        factor.requirementIds.every((id) => ids.has(id)) &&
        matchingFactorQuote(factor, baseline) === undefined,
    )
    .slice(0, 20)
    .map((factor) => ({ factorId: factor.id, requirementIds: factor.requirementIds.slice(0, 8) }));
}

export const designQuoteInstruction =
  'Each factor sourceQuote must be a literal substring of ONE of its explicitly linked requirement quote fields. A paragraph from sourceSpec is not sufficient if those requirements quote only shorter sentences. Narrow the quote to supported text; never add unrelated requirement IDs just to pass validation. Return the complete design JSON with corrected quotes and preserved source-backed coverage.';
