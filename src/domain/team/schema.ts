import Ajv2020 from 'ajv/dist/2020.js';
import type { ProjectInput, TeamAnalysis, TeamCommand, TeamProject } from './types.ts';

const text = { type: 'string', maxLength: 12000 };
const id = { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{0,79}$' };
const nonempty = { ...text, minLength: 1, pattern: '\\S' };
const list = (items: object, maxItems = 200) => ({ type: 'array', maxItems, items });
const record = (properties: Record<string, object>, optional: string[] = []) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties).filter((key) => !optional.includes(key)),
  properties,
});
const factor = record({
  id,
  name: nonempty,
  levels: { ...list(nonempty, 30), minItems: 1, uniqueItems: true },
  basis: { enum: ['explicit', 'hypothesis'] },
  sourceQuote: text,
  rationale: nonempty,
});
const factorValue = record({ factorId: id, level: nonempty });
const review = record({
  decision: { enum: ['accepted', 'needs_changes'] },
  by: id,
  at: nonempty,
  comment: text,
});
const oracleBasis = { enum: ['unknown', 'contract', 'approved_assumption'] };
const scenarioFields = {
  id,
  title: nonempty,
  interfaceIds: { ...list(id, 20), uniqueItems: true },
  factorValues: list(factorValue, 30),
  oracle: text,
  oracleBasis,
  sourceQuote: text,
  ownerId: { type: 'string', maxLength: 80 },
};
export const analysisSchema = record({
  factors: list(factor),
  scenarios: list(record(scenarioFields)),
  questions: list(nonempty, 100),
});
const inputFields = {
  title: { ...nonempty, maxLength: 200 },
  mode: { enum: ['black_box', 'collaborative'] },
  locale: { enum: ['zh-CN', 'en-US'] },
  topic: { ...nonempty, maxLength: 40000 },
  interfaces: list(record({ id, name: nonempty, contract: text }), 20),
};
const ajv = new Ajv2020({ strict: false, allErrors: true });
export const isProjectInput = ajv.compile<ProjectInput>(record(inputFields));
export const isAnalysis = ajv.compile<TeamAnalysis>(analysisSchema);
export const isProject = ajv.compile<TeamProject>(
  record({
    ...inputFields,
    formatVersion: { const: 1 },
    id,
    revision: { type: 'integer', minimum: 1 },
    updatedAt: nonempty,
    updatedBy: id,
    factors: list(factor),
    scenarios: list(record({ ...scenarioFields, review }, ['review'])),
    questions: list(nonempty, 100),
    comments: list(record({ id, scenarioId: id, text: nonempty, by: id, at: nonempty }), 1000),
  }),
);
export const isCommand = ajv.compile<TeamCommand>({
  oneOf: [
    record({ type: { const: 'suggest' } }),
    record({ type: { const: 'replace_analysis' }, analysis: analysisSchema }),
    record({ type: { const: 'upsert_factor' }, factor }),
    record({
      type: { const: 'add_scenario' },
      id,
      title: nonempty,
      interfaceIds: { ...list(id, 20), uniqueItems: true },
    }),
    record({
      type: { const: 'edit_scenario' },
      scenarioId: id,
      title: nonempty,
      oracle: text,
      oracleBasis,
      sourceQuote: text,
      factorValues: list(factorValue, 30),
      ownerId: { type: 'string', maxLength: 80 },
    }),
    record({
      type: { const: 'review' },
      scenarioId: id,
      decision: { enum: ['accepted', 'needs_changes'] },
      comment: text,
    }),
    record({ type: { const: 'comment' }, scenarioId: id, text: nonempty }),
  ],
});
