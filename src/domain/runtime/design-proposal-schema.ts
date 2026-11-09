import Ajv2020 from 'ajv/dist/2020.js';
import { factorSchema, scenarioSchema } from './artifacts';
import type { DesignArtifact } from './types';
import { proposalEnvelope, validProposalMetadata, type ProposalRecord } from './proposal-envelope';

type Factor = NonNullable<DesignArtifact['factors']>[number];
type Scenario = DesignArtifact['scenarios'][number];
type Change<T> = { action: 'add' | 'update'; value: T };
export interface DesignPatch {
  summary: string;
  factors: Change<Factor>[];
  scenarios: Change<Scenario>[];
  questions: string[];
}
export interface DesignProposal extends ProposalRecord {
  patch: DesignPatch;
  before: { factors: Factor[]; scenarios: Scenario[] };
}
const text = { type: 'string', minLength: 1, maxLength: 12000 };
const record = (properties: Record<string, object>, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});
const list = (items: object) => ({ type: 'array', maxItems: 20, items });
const change = (value: object) => record({ action: { enum: ['add', 'update'] }, value });
export const designPatchSchema = record({
  summary: text,
  factors: list(change(factorSchema)),
  scenarios: list(change({ ...scenarioSchema, required: [...scenarioSchema.required, 'factorLevels'] })),
  questions: list(text),
});
const ajv = new Ajv2020({ strict: false, allErrors: true });
export const isDesignPatch = ajv.compile<DesignPatch>(designPatchSchema);
const validateProposal = ajv.compile<DesignProposal>(
  proposalEnvelope(
    designPatchSchema,
    record({ factors: list(factorSchema), scenarios: list(scenarioSchema) }),
  ),
);
export function isDesignProposal(value: unknown): value is DesignProposal {
  return validateProposal(value) && validProposalMetadata(value);
}
