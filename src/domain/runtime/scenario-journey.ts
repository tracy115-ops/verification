import type { RequirementArtifact, ScenarioJourney } from './types';
import { quoteMatcher } from './source-quotes';

const text = { type: 'string', minLength: 1, maxLength: 12000 };
const state = { type: 'string', minLength: 1, maxLength: 160 };
const id = { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{0,79}$' };
const step = {
  id,
  fromState: state,
  action: text,
  toState: state,
  observation: text,
  requirementId: id,
  sourceQuote: text,
};
export const journeySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'initialState', 'preconditions', 'steps'],
  properties: {
    version: { const: 1 },
    initialState: state,
    preconditions: { type: 'array', maxItems: 20, items: text },
    steps: {
      type: 'array',
      minItems: 2,
      maxItems: 12,
      items: { type: 'object', additionalProperties: false, required: Object.keys(step), properties: step },
    },
  },
};

/** Called after schema validation; this proves linkage and continuity, not semantic correctness. */
export function validateJourney(
  journey: ScenarioJourney,
  scenarioRequirementIds: string[],
  requirements: RequirementArtifact,
) {
  const ids = new Set<string>();
  let current = journey.initialState;
  if (!current.trim() || journey.preconditions.some((item) => !item.trim()))
    throw new Error('journey_invalid');
  for (const step of journey.steps) {
    if (
      ids.has(step.id) ||
      step.fromState !== current ||
      ![step.fromState, step.toState, step.action, step.observation].every((item) => item.trim()) ||
      !scenarioRequirementIds.includes(step.requirementId)
    )
      throw new Error('journey_invalid');
    const requirement = requirements.requirements.find((item) => item.id === step.requirementId);
    if (!requirement) throw new Error('journey_invalid');
    try {
      step.sourceQuote = quoteMatcher(requirement.quote)(step.sourceQuote);
    } catch {
      throw new Error('journey_quote_invalid');
    }
    ids.add(step.id);
    current = step.toState;
  }
}
