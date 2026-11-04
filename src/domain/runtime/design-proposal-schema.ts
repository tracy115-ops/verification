import Ajv2020 from 'ajv/dist/2020.js';
import { factorSchema, scenarioSchema } from './artifacts';
import type { DesignArtifact } from './types';

type Factor = NonNullable<DesignArtifact['factors']>[number];
type Scenario = DesignArtifact['scenarios'][number];
type Change<T> = { action: 'add' | 'update'; value: T };
export interface DesignPatch {
  summary: string;
  factors: Change<Factor>[];
  scenarios: Change<Scenario>[];
  questions: string[];
}
export interface DesignProposal {
  version: 1;
  id: string;
  runId: string;
  turnId: string;
  baseDigest: string;
  instruction: string;
  createdAt: string;
  decidedAt?: string;
  status: 'pending' | 'applied' | 'dismissed' | 'stale';
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
const properties = {
  version: { const: 1 },
  id: { ...text, maxLength: 80 },
  runId: { ...text, maxLength: 80 },
  turnId: { ...text, maxLength: 80 },
  baseDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
  instruction: { ...text, maxLength: 40000 },
  createdAt: text,
  decidedAt: text,
  status: { enum: ['pending', 'applied', 'dismissed', 'stale'] },
  patch: designPatchSchema,
  before: record({ factors: list(factorSchema), scenarios: list(scenarioSchema) }),
};
const ajv = new Ajv2020({ strict: false, allErrors: true });
export const isDesignPatch = ajv.compile<DesignPatch>(designPatchSchema);
const validateProposal = ajv.compile<DesignProposal>(
  record(
    properties,
    Object.keys(properties).filter((key) => key !== 'decidedAt'),
  ),
);
export function isDesignProposal(value: unknown): value is DesignProposal {
  return (
    validateProposal(value) &&
    value.id === value.turnId &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    (value.status === 'pending'
      ? value.decidedAt === undefined
      : typeof value.decidedAt === 'string' && Number.isFinite(Date.parse(value.decidedAt)))
  );
}
