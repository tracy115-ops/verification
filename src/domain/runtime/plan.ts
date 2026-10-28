import { checkDocument, type AgentProfile, type WorkbenchDocument } from '../workflow';
import type { WorkflowRun } from './types';
import { newId } from '../../shared/id';
import { inferenceModel } from './profile';
import type { FrameworkProfile } from '../execution/types';
import { decodeFramework } from '../execution/validation';

const designOperations = [
  'documents.import',
  'requirements.extract',
  'review.requirements',
  'scenarios.design',
  'review.coverage',
  'cases.generate',
  'review.cases',
  'review.custom',
];
const executionOperations = [
  'tests.implement',
  'targets.preflight',
  'review.execution',
  'targets.execute',
  'verdicts.evaluate',
  'actions.dispatch',
];

export function createRun(
  snapshot: WorkbenchDocument,
  sessionId: string,
  spec: string,
  profiles: AgentProfile[],
  defaultProfileId: string,
  executionProfile?: FrameworkProfile,
): WorkflowRun {
  if (snapshot.revision < 1 || checkDocument(snapshot).length || !spec.trim() || spec.length > 40000)
    throw new Error('invalid_run');
  const terminal = snapshot.definition.nodes.find(
    (node) => node.operation === (executionProfile ? 'actions.dispatch' : 'review.cases'),
  );
  if (!terminal) throw new Error('unsupported_workflow');
  const selected = new Set<string>();
  const lookup = new Map(snapshot.definition.nodes.map((node) => [node.id, node]));
  function select(id: string) {
    if (selected.has(id)) return;
    const node = lookup.get(id);
    if (!node) throw new Error('invalid_run');
    selected.add(id);
    for (const parent of node.dependsOn) select(parent);
  }
  select(terminal.id);
  const plan = snapshot.definition.nodes.filter((node) => executionProfile || selected.has(node.id));
  const supported = new Set(
    executionProfile ? [...designOperations, ...executionOperations] : designOperations,
  );
  if (plan.some((node) => !supported.has(node.operation))) throw new Error('unsupported_workflow');
  for (const operation of supported) {
    if (operation !== 'review.custom' && plan.filter((node) => node.operation === operation).length !== 1)
      throw new Error('unsupported_workflow');
  }
  for (const node of plan.filter((node) => node.role)) {
    const id = snapshot.bindings[node.id] ?? defaultProfileId;
    const profile = profiles.find((profile) => profile.id === id);
    if (!profile) throw new Error('profile_missing');
    if (profile.protocol !== 'native') throw new Error('unsupported_profile');
    inferenceModel(profile);
  }
  return structuredClone({
    id: newId(),
    sessionId,
    createdAt: new Date().toISOString(),
    scope: executionProfile ? 'verification' : 'design',
    ...(executionProfile ? { executionProfile: decodeFramework(executionProfile) } : {}),
    snapshot,
    plan: structuredClone(plan),
    profiles,
    defaultProfileId,
    spec,
    status: 'ready',
    steps: Object.fromEntries(plan.map((node) => [node.id, { status: 'pending', attempts: 0 }])),
    artifacts: {},
    approvals: [],
  });
}

export async function digest(value: unknown): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
