import Ajv2020 from 'ajv/dist/2020.js';
import preset from '../../docs/examples/general-testing.workflow.json';
import { checkDocument, checkWorkflow, type WorkbenchDocument, type WorkflowNode } from './workflow';

const stringMap = { type: 'object', additionalProperties: { type: 'string' } };
const profileSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'driver', 'protocol', 'baseUrl', 'model', 'credentialRef'],
  properties: {
    id: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    driver: { enum: ['claude', 'codex', 'pi'] },
    protocol: { enum: ['native', 'openai-responses', 'anthropic-messages', 'openai-completions'] },
    baseUrl: { type: 'string' },
    model: { type: 'string' },
    credentialRef: { type: 'string' },
  },
};
const validateEnvelope = new Ajv2020({ strict: false }).compile<WorkbenchDocument>({
  type: 'object',
  additionalProperties: false,
  required: ['formatVersion', 'revision', 'definition', 'profiles', 'bindings', 'layout', 'nodeTitles'],
  properties: {
    formatVersion: { const: 1 },
    revision: { type: 'integer', minimum: 0 },
    definition: { type: 'object' },
    profiles: { type: 'array', maxItems: 100, items: profileSchema },
    bindings: stringMap,
    nodeTitles: stringMap,
    layout: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        required: ['x', 'y'],
        properties: {
          x: { type: 'number', minimum: -100000, maximum: 100000 },
          y: { type: 'number', minimum: -100000, maximum: 100000 },
        },
      },
    },
  },
});

export function decodeDocument(value: unknown): WorkbenchDocument {
  if (!validateEnvelope(value) || checkWorkflow(value.definition).length) throw new Error('invalidDocument');
  if (checkDocument(value).length) throw new Error('invalidDocument');
  return structuredClone(value);
}

export function createDocument(): WorkbenchDocument {
  const value: unknown = {
    formatVersion: 1,
    revision: 0,
    definition: structuredClone(preset),
    profiles: ['codex', 'claude', 'pi'].map((driver) => ({
      id: `${driver}-native`,
      name: `${driver} / native`,
      driver,
      protocol: 'native',
      baseUrl: '',
      model: '',
      credentialRef: '',
    })),
    bindings: Object.fromEntries(
      preset.nodes.filter((node) => node.role).map((node) => [node.id, 'codex-native']),
    ),
    layout: Object.fromEntries(
      preset.nodes.map((node, index) => [
        node.id,
        { x: 80 + (index % 2) * 310, y: 60 + Math.floor(index / 2) * 140 },
      ]),
    ),
    nodeTitles: {},
  };
  return decodeDocument(value);
}

export function addReview(document: WorkbenchDocument, parentId: string): WorkbenchDocument {
  const next = structuredClone(document);
  const parent = next.definition.nodes.find((node) => node.id === parentId);
  if (!parent) throw new Error('unknownDependency');
  const id = `review_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const node: WorkflowNode = {
    id,
    kind: 'human',
    operation: 'review.custom',
    dependsOn: [parentId],
    inputs: {},
    outputs: { approval: 'ApprovalRecord' },
    requiresCapabilities: ['digest-bound-approval'],
    policy: { timeoutSeconds: 3600, maxAttempts: 1, retryOn: [] },
  };
  next.definition.nodes.push(node);
  const parentPosition = next.layout[parentId] ?? { x: 0, y: 0 };
  next.layout[id] = { x: parentPosition.x + 310, y: parentPosition.y + 70 };
  return next;
}

export function addDependency(
  document: WorkbenchDocument,
  source: string,
  target: string,
): WorkbenchDocument {
  const next = structuredClone(document);
  const node = next.definition.nodes.find((item) => item.id === target);
  if (!node || !next.definition.nodes.some((item) => item.id === source))
    throw new Error('unknownDependency');
  if (!node.dependsOn.includes(source)) node.dependsOn.push(source);
  const issues = checkWorkflow(next.definition);
  if (issues.length) throw new Error(issues[0].code);
  return next;
}
