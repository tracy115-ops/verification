import Ajv2020 from 'ajv/dist/2020.js';
import definitionSchema from '../../docs/schemas/workflow-definition.schema.json';
import { operationKinds } from './node-registry';

export type NodeKind = 'import' | 'agent' | 'human' | 'validation' | 'runner' | 'evaluation' | 'policy';
export type DriverId = 'codeagent' | 'claude' | 'codex' | 'pi';
export type Protocol = 'native' | 'openai-responses' | 'anthropic-messages' | 'openai-completions';
export interface Binding {
  from: string;
  type: string;
}
export interface WorkflowNode {
  id: string;
  kind: NodeKind;
  operation: string;
  role?: string;
  dependsOn: string[];
  inputs: Record<string, Binding>;
  outputs: Record<string, string>;
  requiresCapabilities: string[];
  policy: { timeoutSeconds: number; maxAttempts: number; retryOn: string[] };
}
export interface WorkflowDefinition {
  $schema?: string;
  schemaVersion: '1.0.0';
  id: string;
  version: string;
  status: 'draft' | 'published';
  name: string;
  description?: string;
  contentLocale: 'zh-CN' | 'en-US' | 'source';
  limits: { deadlineSeconds: number; maxConcurrentNodes: number; maxDerivedRuns: number };
  inputs: Record<string, { type: string; required: boolean; description?: string }>;
  nodes: WorkflowNode[];
}
export interface AgentProfile {
  id: string;
  name: string;
  driver: DriverId;
  protocol: Protocol;
  baseUrl: string;
  model: string;
  credentialRef: string;
}
export interface WorkbenchDocument {
  formatVersion: 1;
  revision: number;
  definition: WorkflowDefinition;
  profiles: AgentProfile[];
  bindings: Record<string, string>;
  layout: Record<string, { x: number; y: number }>;
  nodeTitles: Record<string, string>;
}
export type IssueCode =
  | 'invalidStructure'
  | 'duplicateId'
  | 'unknownDependency'
  | 'cycle'
  | 'invalidBinding'
  | 'typeMismatch'
  | 'invalidProfile'
  | 'unknownProfile'
  | 'unknownOperation'
  | 'invalidDocument';
export interface WorkflowIssue {
  code: IssueCode;
  detail: string;
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateDefinition = ajv.compile<WorkflowDefinition>(definitionSchema);

export function checkWorkflow(value: unknown): WorkflowIssue[] {
  if (!validateDefinition(value)) {
    return [{ code: 'invalidStructure', detail: validateDefinition.errors?.[0]?.instancePath || '/' }];
  }
  const ids = value.nodes.map((node) => node.id);
  if (new Set(ids).size !== ids.length) return [{ code: 'duplicateId', detail: '' }];
  const lookup = new Map(value.nodes.map((node) => [node.id, node]));
  const ancestors = new Map<string, Set<string>>();
  const active = new Set<string>();
  const issues: WorkflowIssue[] = [];
  for (const node of value.nodes) {
    if (operationKinds.get(node.operation) !== node.kind)
      issues.push({ code: 'unknownOperation', detail: node.id });
  }
  if (issues.length) return issues;
  function visit(id: string): Set<string> {
    if (active.has(id)) {
      issues.push({ code: 'cycle', detail: id });
      return new Set();
    }
    const cached = ancestors.get(id);
    if (cached) return cached;
    const node = lookup.get(id);
    if (!node) {
      issues.push({ code: 'unknownDependency', detail: id });
      return new Set();
    }
    active.add(id);
    const found = new Set<string>();
    for (const parent of node.dependsOn) {
      found.add(parent);
      for (const ancestor of visit(parent)) found.add(ancestor);
    }
    active.delete(id);
    ancestors.set(id, found);
    return found;
  }
  for (const node of value.nodes) visit(node.id);
  if (issues.length) return issues;
  for (const node of value.nodes) {
    for (const input of Object.values(node.inputs)) {
      const [source, slot] = input.from.split('.');
      const outputs = lookup.get(source)?.outputs;
      const expected =
        source === '$input'
          ? Object.hasOwn(value.inputs, slot)
            ? value.inputs[slot].type
            : undefined
          : outputs && Object.hasOwn(outputs, slot)
            ? outputs[slot]
            : undefined;
      if (source !== '$input' && !ancestors.get(node.id)?.has(source)) {
        issues.push({ code: 'invalidBinding', detail: `${node.id}: ${input.from}` });
      } else if (!expected) {
        issues.push({ code: 'invalidBinding', detail: `${node.id}: ${input.from}` });
      } else if (expected !== input.type) {
        issues.push({ code: 'typeMismatch', detail: `${node.id}: ${input.from}` });
      }
    }
  }
  return issues;
}

export function profileIsCompatible(profile: AgentProfile): boolean {
  if (profile.driver === 'codeagent')
    return (
      profile.protocol === 'native' &&
      !profile.model &&
      !profile.baseUrl &&
      !profile.credentialRef &&
      !!profile.name.trim()
    );
  if (
    !profile.name.trim() ||
    !/^(|env:[A-Z_][A-Z0-9_]*|keychain:[a-zA-Z0-9_/-]+)$/.test(profile.credentialRef)
  )
    return false;
  if (profile.protocol === 'native') return !profile.baseUrl && !profile.credentialRef;
  const protocols: Record<DriverId, Protocol[]> = {
    codeagent: [],
    codex: ['openai-responses'],
    claude: ['anthropic-messages'],
    pi: ['openai-responses', 'anthropic-messages', 'openai-completions'],
  };
  if (!protocols[profile.driver].includes(profile.protocol) || !profile.model.trim()) return false;
  try {
    const url = new URL(profile.baseUrl);
    return (
      ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash
    );
  } catch {
    return false;
  }
}

export function checkDocument(document: WorkbenchDocument): WorkflowIssue[] {
  const issues = checkWorkflow(document.definition);
  const profileIds = new Set<string>();
  for (const profile of document.profiles) {
    if (profileIds.has(profile.id) || !profileIsCompatible(profile))
      issues.push({ code: 'invalidProfile', detail: profile.id });
    profileIds.add(profile.id);
  }
  for (const [nodeId, profileId] of Object.entries(document.bindings)) {
    const node = document.definition.nodes.find((item) => item.id === nodeId);
    if (!node?.role || !profileIds.has(profileId)) issues.push({ code: 'unknownProfile', detail: nodeId });
  }
  return issues;
}
