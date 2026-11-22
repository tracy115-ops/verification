import Ajv2020 from 'ajv/dist/2020.js';
import type { WorkflowRun } from './types';
import { descendants } from './descendants';

export interface ReproductionSource {
  version: 1;
  sourceRunId: string;
  reportDigest: string;
  evidenceDigest: string;
  planDigest: string;
  candidateId: string;
  candidateTitle: string;
  testNames: string[];
  scriptSha256: string;
  frameworkSha256: string;
  targetUrl: string;
  inheritedNodeIds: string[];
}
const text = { type: 'string', minLength: 1, maxLength: 12000 };
const hash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const properties = {
  version: { const: 1 },
  sourceRunId: { type: 'string', pattern: '^[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}$' },
  reportDigest: text,
  evidenceDigest: hash,
  planDigest: hash,
  candidateId: text,
  candidateTitle: text,
  testNames: {
    type: 'array',
    minItems: 1,
    maxItems: 200,
    uniqueItems: true,
    items: { type: 'string', pattern: '^test_[A-Za-z0-9_]{1,155}$' },
  },
  scriptSha256: hash,
  frameworkSha256: hash,
  targetUrl: text,
  inheritedNodeIds: { type: 'array', maxItems: 100, uniqueItems: true, items: text },
};
const validate = new Ajv2020({ strict: false }).compile<ReproductionSource>({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
export function reproductionSource(run: WorkflowRun): ReproductionSource | undefined {
  const artifact = run.artifacts['reproduction.source'];
  if (!artifact) return;
  if (
    artifact.type !== 'ReproductionSource' ||
    !validate(artifact.value) ||
    artifact.value.sourceRunId === run.id ||
    artifact.value.inheritedNodeIds.some((id) => !run.plan.some((node) => node.id === id))
  )
    throw new Error('session_storage_invalid');
  const source = artifact.value;
  const preflight = run.plan.find((node) => node.operation === 'targets.preflight');
  const execute = run.plan.find((node) => node.operation === 'targets.execute');
  const review = run.plan.find((node) => node.operation === 'review.execution');
  if (!preflight || !execute || !review) throw new Error('session_storage_invalid');
  const fresh = descendants(run.plan, [preflight.id]);
  const inherited = run.plan.filter((node) => !fresh.has(node.id));
  if (
    inherited.length !== source.inheritedNodeIds.length ||
    inherited.some(
      (node) => !source.inheritedNodeIds.includes(node.id) || run.steps[node.id]?.status !== 'succeeded',
    ) ||
    run.plan.some(
      (node) =>
        fresh.has(node.id) &&
        !['targets.preflight', 'review.execution', 'targets.execute', 'review.custom'].includes(
          node.operation,
        ),
    ) ||
    Object.values(run.artifacts).some((item) => item.type === 'VerificationReport')
  )
    throw new Error('session_storage_invalid');
  return source;
}
