export interface ProposalRecord {
  version: 1;
  id: string;
  runId: string;
  turnId: string;
  baseDigest: string;
  instruction: string;
  createdAt: string;
  decidedAt?: string;
  status: 'pending' | 'applied' | 'dismissed' | 'stale';
}

export function proposalEnvelope(patch: object, before: object) {
  const text = { type: 'string', minLength: 1, maxLength: 12000 };
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
    patch,
    before,
  };
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties).filter((key) => key !== 'decidedAt'),
  };
}

export function validProposalMetadata(value: ProposalRecord) {
  return (
    value.id === value.turnId &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    (value.status === 'pending'
      ? value.decidedAt === undefined
      : typeof value.decidedAt === 'string' && Number.isFinite(Date.parse(value.decidedAt)))
  );
}
