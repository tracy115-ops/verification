import Ajv2020 from 'ajv/dist/2020.js';
import { decodeDocument } from '../domain/document';
import { checkWorkflow } from '../domain/workflow';
import type { ConversationSession } from '../domain/runtime/types';
import { frameworkSchema } from '../domain/execution/schema';
import { decodeFramework } from '../domain/execution/validation';
import { caseSchema } from '../domain/runtime/artifacts';

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
      decodeDocument(run.snapshot);
      decodeDocument({ ...run.snapshot, profiles: run.profiles });
      if (checkWorkflow({ ...run.snapshot.definition, nodes: run.plan }).length)
        throw new Error('session_storage_invalid');
      if (run.plan.some((node) => !run.steps[node.id])) throw new Error('session_storage_invalid');
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
