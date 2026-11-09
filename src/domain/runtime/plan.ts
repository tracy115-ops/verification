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
  agentSelection: 'bindings' | 'session' = 'bindings',
): WorkflowRun {
  if (agentSelection === 'session') snapshot = { ...snapshot, bindings: {} };
  if (snapshot.revision < 1 || checkDocument(snapshot).length || !spec.trim() || spec.length > 40000)
    throw new Error('invalid_run');
  const plan = selectRunPlan(snapshot, !!executionProfile);
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

/** Select the same scope for readiness previews and actual immutable runs. Validate the graph first. */
export function selectRunPlan(snapshot: WorkbenchDocument, execution: boolean) {
  const terminal = snapshot.definition.nodes.find(
    (node) => node.operation === (execution ? 'actions.dispatch' : 'review.cases'),
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
  // Custom reviews attached to the chosen design path must remain visible even
  // when they are placed after the standard case-review terminal.
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const node of snapshot.definition.nodes) {
      if (
        node.operation === 'review.custom' &&
        !selected.has(node.id) &&
        node.dependsOn.length > 0 &&
        node.dependsOn.every((id) => selected.has(id))
      ) {
        selected.add(node.id);
        expanded = true;
      }
    }
  }
  const plan = snapshot.definition.nodes.filter((node) => execution || selected.has(node.id));
  const supported = new Set(execution ? [...designOperations, ...executionOperations] : designOperations);
  if (plan.some((node) => !supported.has(node.operation))) throw new Error('unsupported_workflow');
  for (const operation of supported) {
    if (operation !== 'review.custom' && plan.filter((node) => node.operation === operation).length !== 1)
      throw new Error('unsupported_workflow');
  }
  return plan;
}

export async function digest(value: unknown): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
