import Ajv2020 from 'ajv/dist/2020.js';
import { caseItemSchema } from './artifacts';
import type { CaseArtifact } from './types';
import { proposalEnvelope, validProposalMetadata, type ProposalRecord } from './proposal-envelope';

export interface CasePatch {
  summary: string;
  cases: { action: 'add' | 'update'; value: CaseArtifact['cases'][number] }[];
  questions: string[];
}
export interface CaseProposal extends ProposalRecord {
  patch: CasePatch;
  before: CaseArtifact;
}
const record = (properties: Record<string, object>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const text = { type: 'string', minLength: 1, maxLength: 12000 };
const list = (items: object) => ({ type: 'array', maxItems: 20, items });
export const casePatchSchema = record({
  summary: text,
  cases: list(record({ action: { enum: ['add', 'update'] }, value: caseItemSchema })),
  questions: list(text),
});
const ajv = new Ajv2020({ strict: false, allErrors: true });
export const isCasePatch = ajv.compile<CasePatch>(casePatchSchema);
const validate = ajv.compile<CaseProposal>(
  proposalEnvelope(casePatchSchema, record({ cases: list(caseItemSchema) })),
);
export function isCaseProposal(value: unknown): value is CaseProposal {
  return validate(value) && validProposalMetadata(value);
}
