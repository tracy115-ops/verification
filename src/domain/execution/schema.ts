import Ajv2020 from 'ajv/dist/2020.js';
import type {
  EvidenceBundle,
  ExecutionPlan,
  FrameworkProfile,
  ImplementationBundle,
  VerdictAnalysis,
  VerificationReport,
} from './types';
const text = { type: 'string', maxLength: 12000 };
const id = { type: 'string', minLength: 1, maxLength: 80 };
const name = { type: 'string', pattern: '^test_[A-Za-z0-9_]{1,155}$' };
const hash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const uuid = {
  type: 'string',
  pattern: '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$',
};
const list = (items: object, minItems = 0, maxItems = 200) => ({ type: 'array', minItems, maxItems, items });
const record = (properties: Record<string, object>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
export const frameworkSchema = record({
  id,
  name: { type: 'string', minLength: 1, maxLength: 200 },
  adapter: { const: 'python-unittest-v1' },
  pythonCommand: { type: 'string', minLength: 1, maxLength: 2000 },
  frameworkSource: { type: 'string', minLength: 1, maxLength: 60000 },
  instructions: text,
  targetUrl: { type: 'string', minLength: 1, maxLength: 2000 },
  timeoutSeconds: { type: 'integer', minimum: 1, maximum: 300 },
});
export const implementationSchema = record({
  script: { type: 'string', minLength: 1, maxLength: 100000 },
  tests: list(record({ testName: name, caseIds: { ...list(id, 1), uniqueItems: true } }), 1),
  questions: list(text),
});
const payload = record({
  sessionId: uuid,
  runId: uuid,
  executionId: uuid,
  profile: frameworkSchema,
  implementation: implementationSchema,
});
export const planSchema = record({
  digest: hash,
  scriptSha256: hash,
  frameworkSha256: hash,
  pythonVersion: { type: 'string', minLength: 1, maxLength: 100 },
  testNames: { ...list(name, 1), uniqueItems: true },
  payload,
});
export const evidenceSchema = record({
  executionId: uuid,
  planDigest: hash,
  results: list(
    record({
      testName: name,
      status: { enum: ['passed', 'failed', 'error', 'skipped'] },
      details: list({ type: 'string', maxLength: 48000 }),
    }),
    1,
  ),
  requests: list({}, 0, 500),
  rawEvidenceSha256: hash,
  resultSha256: hash,
  workspaceId: { type: 'string', pattern: '^[a-fA-F0-9-]{36}-execute$' },
});
export const verdictSchema = record({
  candidates: list(
    record({
      id,
      title: { ...text, minLength: 1 },
      explanation: { ...text, minLength: 1 },
      testNames: { ...list(name, 1), uniqueItems: true },
      caseIds: { ...list(id, 1), uniqueItems: true },
    }),
  ),
  notes: list(text),
});
const reportBaseSchema = record({
  status: { enum: ['passed', 'candidates_found', 'inconclusive'] },
  counts: record(
    Object.fromEntries(
      ['passed', 'failed', 'error', 'skipped'].map((key) => [key, { type: 'integer', minimum: 0 }]),
    ),
  ),
  candidates: verdictSchema.properties.candidates,
  notes: list(text),
  action: {
    enum: ['archive_results', 'review_candidates', 'repair_test_environment', 'review_coverage_exclusions'],
  },
  policy: { const: 'report_only' },
  evidenceDigest: hash,
});
export const reportSchema = {
  ...reportBaseSchema,
  properties: {
    ...reportBaseSchema.properties,
    reviewExclusions: list(
      record({
        nodeId: id,
        issue: { ...text, minLength: 1 },
        reason: { ...text, minLength: 1 },
        recordedAt: { ...text, minLength: 1 },
      }),
    ),
  },
};
const ajv = new Ajv2020({ strict: false, allErrors: true });
export const isFramework = ajv.compile<FrameworkProfile>(frameworkSchema);
export const isImplementation = ajv.compile<ImplementationBundle>(implementationSchema);
export const isExecutionPlan = ajv.compile<ExecutionPlan>(planSchema);
export const isEvidence = ajv.compile<EvidenceBundle>(evidenceSchema);
export const isVerdict = ajv.compile<VerdictAnalysis>(verdictSchema);
export const isReport = ajv.compile<VerificationReport>(reportSchema);
