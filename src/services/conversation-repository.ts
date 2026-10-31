import Ajv2020 from 'ajv/dist/2020.js';
import { decodeDocument } from '../domain/document';
import { checkWorkflow } from '../domain/workflow';
import type { ConversationSession } from '../domain/runtime/types';
import { frameworkSchema } from '../domain/execution/schema';
import { decodeFramework } from '../domain/execution/validation';
import { caseSchema, requirementIncrementSchema, designIncrementSchema } from '../domain/runtime/artifacts';

export const CONVERSATIONS_KEY = 'verification-workbench.conversations.v1';
const string = { type: 'string' };
const optionalStrings = { errorCode: string, nativeSessionId: string };
const step = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'attempts'],
  properties: {
    status: { enum: ['pending', 'running', 'awaiting_review', 'succeeded', 'failed', 'interrupted'] },
    attempts: { type: 'integer', minimum: 0 },
    caseBatchAttempts: { type: 'integer', minimum: 0 },
    analysis: {
      type: 'object',
      additionalProperties: false,
      required: ['version', 'signature', 'kind', 'total', 'localTotal', 'completed'],
      properties: {
        version: { const: 1 },
        signature: { type: 'string', pattern: '^[a-f0-9]{64}$' },
        kind: { enum: ['requirements', 'design'] },
        total: { type: 'integer', minimum: 1, maximum: 600 },
        localTotal: { type: 'integer', minimum: 1, maximum: 80 },
        completed: {
          type: 'array',
          maxItems: 600,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['index', 'digest', 'value'],
            properties: {
              index: { type: 'integer', minimum: 0, maximum: 599 },
              digest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
              value: { anyOf: [requirementIncrementSchema, designIncrementSchema] },
            },
          },
        },
        rejected: {
          type: 'object',
          additionalProperties: false,
          required: ['index', 'value'],
          properties: {
            index: { type: 'integer', minimum: 0, maximum: 599 },
            value: requirementIncrementSchema,
          },
        },
      },
    },
    turnId: string,
    executionId: string,
    reviewDigest: string,
    caseBatches: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['signature', 'index', 'cases'],
        properties: { signature: string, index: { type: 'integer', minimum: 0 }, cases: caseSchema },
      },
    },
    ...optionalStrings,
  },
};
const run = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'sessionId',
    'createdAt',
    'scope',
    'snapshot',
    'plan',
    'profiles',
    'defaultProfileId',
    'spec',
    'status',
    'steps',
    'artifacts',
    'approvals',
  ],
  properties: {
    id: string,
    sessionId: string,
    createdAt: string,
    resumedAt: string,
    scope: { enum: ['design', 'verification'] },
    executionProfile: frameworkSchema,
    snapshot: { type: 'object' },
    plan: { type: 'array', maxItems: 100 },
    profiles: { type: 'array', maxItems: 100 },
    defaultProfileId: string,
    spec: { type: 'string', maxLength: 40000 },
    clarifications: {
      type: 'array',
      maxItems: 200,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'answer', 'recordedAt'],
        properties: {
          question: { type: 'string', minLength: 1, maxLength: 12000 },
          answer: { type: 'string', minLength: 1, maxLength: 12000 },
          recordedAt: string,
        },
      },
    },
    reviewExclusions: {
      type: 'array',
      maxItems: 200,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nodeId', 'issue', 'reason', 'recordedAt'],
        properties: {
          nodeId: string,
          issue: { type: 'string', minLength: 1, maxLength: 12000 },
          reason: { type: 'string', minLength: 1, maxLength: 12000 },
          recordedAt: string,
        },
      },
    },
    status: {
      enum: ['ready', 'running', 'awaiting_review', 'completed', 'failed', 'cancelled', 'interrupted'],
    },
    steps: { type: 'object', additionalProperties: step },
    errorCode: string,
    artifacts: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'value', 'digest'],
        properties: { type: string, value: {}, digest: string },
      },
    },
    approvals: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nodeId', 'digest', 'approvedAt'],
        properties: { nodeId: string, digest: string, approvedAt: string },
      },
    },
  },
};
const sessionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'title', 'profileId', 'messages', 'runs'],
  properties: {
    id: string,
    title: string,
    profileId: string,
    activeTurnId: string,
    messages: {
      type: 'array',
      maxItems: 200,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'role', 'text', 'createdAt', 'status'],
        properties: {
          id: string,
          role: { enum: ['user', 'assistant'] },
          text: { type: 'string', maxLength: 2097152 },
          createdAt: string,
          status: { enum: ['complete', 'failed', 'interrupted'] },
          ...optionalStrings,
        },
      },
    },
    runs: { type: 'array', maxItems: 50, items: run },
  },
};
const validate = new Ajv2020({ strict: false }).compile<ConversationSession[]>({
  type: 'array',
  maxItems: 50,
  items: sessionSchema,
});

export function decodeConversations(value: unknown): ConversationSession[] {
  if (!validate(value)) throw new Error('session_storage_invalid');
  const sessions = structuredClone(value);
  for (const session of sessions) {
    for (const run of session.runs) {
      if (run.scope === 'verification') decodeFramework(run.executionProfile);
      if (!Number.isFinite(Date.parse(run.createdAt))) throw new Error('session_storage_invalid');
      if (run.resumedAt !== undefined && !Number.isFinite(Date.parse(run.resumedAt)))
        throw new Error('session_storage_invalid');
      decodeDocument(run.snapshot);
      decodeDocument({ ...run.snapshot, profiles: run.profiles });
      if (checkWorkflow({ ...run.snapshot.definition, nodes: run.plan }).length)
        throw new Error('session_storage_invalid');
      if (run.plan.some((node) => !run.steps[node.id])) throw new Error('session_storage_invalid');
      for (const node of run.plan) {
        const checkpoint = run.steps[node.id].analysis;
        if (!checkpoint) continue;
        const indexes = checkpoint.completed.map((item) => item.index);
        if (
          node.operation !==
            (checkpoint.kind === 'requirements' ? 'requirements.extract' : 'scenarios.design') ||
          checkpoint.localTotal > checkpoint.total ||
          new Set(indexes).size !== indexes.length ||
          indexes.some((index) => index >= checkpoint.total) ||
          (checkpoint.kind === 'requirements'
            ? checkpoint.localTotal !== checkpoint.total
            : checkpoint.localTotal > 32 ||
              checkpoint.total !== (checkpoint.localTotal * (checkpoint.localTotal + 1)) / 2) ||
          (checkpoint.rejected &&
            (checkpoint.kind !== 'requirements' ||
              checkpoint.rejected.index >= checkpoint.total ||
              indexes.includes(checkpoint.rejected.index))) ||
          (run.steps[node.id].status === 'succeeded' && indexes.length !== checkpoint.total)
        )
          throw new Error('session_storage_invalid');
      }
      if (
        run.plan.some(
          (node) =>
            !run.snapshot.definition.nodes.some(
              (original) => JSON.stringify(original) === JSON.stringify(node),
            ),
        )
      )
        throw new Error('session_storage_invalid');
      if (['running', 'ready'].includes(run.status)) {
        run.status = 'interrupted';
        for (const step of Object.values(run.steps))
          if (step.status === 'running') step.status = 'interrupted';
        if (!Object.values(run.steps).some((step) => step.status === 'interrupted')) {
          const next = run.plan.find(
            (node) =>
              run.steps[node.id].status === 'pending' &&
              node.dependsOn.every((id) => run.steps[id]?.status === 'succeeded'),
          );
          if (next) run.steps[next.id].status = 'interrupted';
        }
      }
    }
  }
  return sessions;
}

export function loadConversations(storage: Pick<Storage, 'getItem'>): ConversationSession[] {
  const text = storage.getItem(CONVERSATIONS_KEY);
  return text ? decodeConversations(JSON.parse(text)) : [];
}

export function saveConversations(storage: Pick<Storage, 'setItem'>, sessions: ConversationSession[]): void {
  if (!validate(sessions)) throw new Error('session_storage_invalid');
  const text = JSON.stringify(sessions);
  if (text.length > 2_000_000) throw new Error('session_storage_full');
  storage.setItem(CONVERSATIONS_KEY, text);
}
