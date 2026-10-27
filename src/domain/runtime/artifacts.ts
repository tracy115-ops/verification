import Ajv2020 from 'ajv/dist/2020.js';
import type { CaseArtifact, DesignArtifact, RequirementArtifact } from './types';

const text = { type: 'string', minLength: 1, maxLength: 12000 };
const id = { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{0,79}$' };
const list = (item: object, minItems = 1) => ({ type: 'array', minItems, maxItems: 200, items: item });
function record(properties: Record<string, object>) {
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
}
export const requirementSchema = record({
  requirements: list(record({ id, text, quote: text, acceptanceCriteria: list(text) })),
  questions: list(text, 0),
});
export const designSchema = record({
  strategy: text,
  scenarios: list(record({ id, title: text, requirementIds: list(id), dimension: text, expected: text })),
  gaps: list(text, 0),
});
export const caseSchema = record({
  cases: list(
    record({
      id,
      title: text,
      scenarioIds: list(id),
      requirementIds: list(id),
      preconditions: list(text, 0),
      steps: list(text),
      expected: text,
      assertions: list(text),
    }),
  ),
});
const ajv = new Ajv2020({ strict: false, allErrors: true });
export const isRequirements = ajv.compile<RequirementArtifact>(requirementSchema);
export const isDesign = ajv.compile<DesignArtifact>(designSchema);
export const isCases = ajv.compile<CaseArtifact>(caseSchema);

function unique(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}
function fail(condition: boolean, code = 'artifact_invalid'): void {
  if (!condition) throw new Error(code);
}

export function decodeRequirements(value: unknown, spec: string): RequirementArtifact {
  fail(isRequirements(value));
  if (!isRequirements(value)) throw new Error('artifact_invalid');
  fail(unique(value.requirements.map((item) => item.id)));
  for (const requirement of value.requirements) {
    fail(spec.includes(requirement.quote), 'source_quote_invalid');
    fail(spec.indexOf(requirement.quote) === spec.lastIndexOf(requirement.quote), 'source_quote_ambiguous');
  }
  return value;
}

export function decodeDesign(value: unknown, requirements: RequirementArtifact): DesignArtifact {
  if (!isDesign(value)) throw new Error('artifact_invalid');
  fail(unique(value.scenarios.map((item) => item.id)));
  const ids = new Set(requirements.requirements.map((item) => item.id));
  for (const scenario of value.scenarios)
    fail(unique(scenario.requirementIds) && scenario.requirementIds.every((id) => ids.has(id)));
  return value;
}

export function decodeCases(
  value: unknown,
  requirements: RequirementArtifact,
  design: DesignArtifact,
): CaseArtifact {
  if (!isCases(value)) throw new Error('artifact_invalid');
  fail(unique(value.cases.map((item) => item.id)));
  const ids = new Set(requirements.requirements.map((item) => item.id));
  const scenarios = new Map(design.scenarios.map((item) => [item.id, item]));
  for (const item of value.cases) {
    fail(unique(item.scenarioIds) && unique(item.requirementIds));
    fail(item.scenarioIds.every((id) => scenarios.has(id)) && item.requirementIds.every((id) => ids.has(id)));
    const mapped = new Set(item.scenarioIds.flatMap((id) => scenarios.get(id)?.requirementIds ?? []));
    fail(
      item.requirementIds.every((id) => mapped.has(id)) &&
        [...mapped].every((id) => item.requirementIds.includes(id)),
    );
  }
  return value;
}

export function parseArtifact(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1');
  if (trimmed.length > 262144) throw new Error('artifact_invalid');
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error('artifact_invalid');
  }
}
