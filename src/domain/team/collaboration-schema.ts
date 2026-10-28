import Ajv2020 from 'ajv/dist/2020.js';
import { factor, id, list, nonempty, record, review, scenarioFields, text } from './schema-parts.ts';
import type { ContributionInput, ScriptInput } from './collaboration.ts';

const revision = { type: 'integer', minimum: 1 };
const hash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
export const caseFields = {
  id,
  title: nonempty,
  scenarioIds: { ...list(id, 30), minItems: 1, uniqueItems: true },
  preconditions: list(nonempty, 30),
  steps: list(nonempty, 50),
  expected: text,
  assertions: list(nonempty, 30),
  ownerId: { type: 'string', maxLength: 80 },
};
export const changeSchemas = [
  record({ kind: { const: 'factor' }, value: factor }),
  record({ kind: { const: 'scenario' }, value: record(scenarioFields) }),
  record({ kind: { const: 'case' }, value: record(caseFields) }),
];
const change = { oneOf: changeSchemas };
const itemSchemas = changeSchemas.map((schema) =>
  record({ ...schema.properties, id, action: { enum: ['add', 'update'] }, reason: nonempty }),
);
export const contributionSchema = record({
  version: { const: 1 },
  baseRevision: revision,
  source: record({
    kind: { enum: ['human', 'agent'] },
    name: { ...nonempty, maxLength: 200 },
    runId: { ...text, maxLength: 200 },
  }),
  items: { ...list({ oneOf: itemSchemas }, 100), minItems: 1 },
});
const resolution = record({ by: id, at: nonempty, comment: text, applied: change }, ['applied']);
const proposalItem = {
  oneOf: itemSchemas.map((schema) =>
    record(
      { ...schema.properties, before: {}, status: { enum: ['pending', 'accepted', 'rejected'] }, resolution },
      ['resolution'],
    ),
  ),
};
const contribution = record({
  ...contributionSchema.properties,
  id,
  by: id,
  at: nonempty,
  items: list(proposalItem, 100),
});
export const scriptSchema = record(
  {
    version: { const: 1 },
    name: { type: 'string', pattern: '^[A-Za-z0-9_.-]{1,120}\\.py$' },
    source: { type: 'string', minLength: 1, maxLength: 100000 },
    mappings: {
      ...list(
        record(
          {
            caseId: id,
            caseRevision: revision,
            definition: record(caseFields),
            testNames: {
              ...list({ type: 'string', pattern: '^test_[A-Za-z0-9_]{1,155}$' }, 200),
              minItems: 1,
              uniqueItems: true,
            },
          },
          ['definition'],
        ),
      ),
      minItems: 1,
    },
    execution: record({
      runId: nonempty,
      executionId: nonempty,
      scriptSha256: hash,
      evidenceDigest: hash,
      results: list(
        record({ testName: nonempty, status: { enum: ['passed', 'failed', 'error', 'skipped'] } }),
        300,
      ),
    }),
  },
  ['execution'],
);
export const collaborationSchema = record({
  version: { const: 1 },
  cases: list(
    record(
      {
        ...caseFields,
        revision,
        review,
        declaration: record({ by: id, at: nonempty, note: nonempty, caseRevision: revision }),
      },
      ['review', 'declaration'],
    ),
  ),
  contributions: list(contribution, 100),
  scripts: list(
    record(
      { ...scriptSchema.properties, id, sha256: hash, methods: list(nonempty, 300), by: id, at: nonempty },
      ['execution'],
    ),
    30,
  ),
});
export const collaborationCommands = [
  record({ type: { const: 'propose' }, proposal: contributionSchema }),
  record(
    {
      type: { const: 'resolve_proposal' },
      proposalId: id,
      itemId: id,
      decision: { enum: ['accepted', 'rejected'] },
      comment: text,
      applied: change,
    },
    ['applied'],
  ),
  record({
    type: { const: 'upsert_case' },
    value: record(caseFields),
    caseRevision: { type: 'integer', minimum: 0 },
  }),
  record({
    type: { const: 'review_case' },
    caseId: id,
    caseRevision: revision,
    decision: { enum: ['accepted', 'needs_changes'] },
    comment: text,
  }),
  record({
    type: { const: 'declare_coverage' },
    caseId: id,
    caseRevision: revision,
    covered: { type: 'boolean' },
    note: text,
  }),
];
const ajv = new Ajv2020({ strict: false });
export const isContribution = ajv.compile<ContributionInput>(contributionSchema);
export const isScriptInput = ajv.compile<ScriptInput>(scriptSchema);
