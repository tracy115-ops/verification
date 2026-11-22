import { candidateReproduction } from './candidate-reproduction';
import type { WorkflowRun } from './types';
import type { ReproductionSource } from './reproduction-source';
import { digest } from './plan';
import { newId } from '../../shared/id';
import { descendants } from './descendants';

export type StartReproduction = (
  run: WorkflowRun,
  reportDigest: string,
  candidateId: string,
) => Promise<boolean>;
const repeated = new Set(['targets.preflight', 'review.execution', 'targets.execute']);

export async function createReproductionRun(initial: WorkflowRun, reportDigest: string, candidateId: string) {
  initial = structuredClone(initial);
  if (initial.status !== 'completed') throw new Error('reproduction_unavailable');
  const bundle = await candidateReproduction(initial, reportDigest, candidateId);
  const execute = initial.plan.find((node) => node.operation === 'targets.execute');
  if (!execute) throw new Error('reproduction_unavailable');
  const selected = new Set<string>();
  function select(id: string) {
    if (selected.has(id)) return;
    const node = initial.plan.find((item) => item.id === id);
    if (!node) throw new Error('reproduction_unavailable');
    selected.add(id);
    node.dependsOn.forEach(select);
  }
  select(execute.id);
  const plan = initial.plan.filter((node) => selected.has(node.id));
  const preflight = plan.find((node) => node.operation === 'targets.preflight');
  if (
    !preflight ||
    plan.filter((node) => repeated.has(node.operation)).length !== 3 ||
    plan.some((node) => initial.steps[node.id]?.status !== 'succeeded')
  )
    throw new Error('reproduction_unavailable');
  const fresh = descendants(plan, [preflight.id]);
  if (plan.some((node) => fresh.has(node.id) && ![...repeated, 'review.custom'].includes(node.operation)))
    throw new Error('reproduction_unavailable');
  const inherited = plan.filter((node) => !fresh.has(node.id));
  const inheritedKeys = new Set(
    inherited.flatMap((node) => Object.keys(node.outputs).map((slot) => `${node.id}.${slot}`)),
  );
  const run: WorkflowRun = {
    id: newId(),
    sessionId: initial.sessionId,
    createdAt: new Date().toISOString(),
    scope: 'verification',
    executionProfile: structuredClone(bundle.framework),
    snapshot: structuredClone(initial.snapshot),
    plan: structuredClone(plan),
    profiles: structuredClone(initial.profiles),
    defaultProfileId: initial.defaultProfileId,
    spec: initial.spec,
    status: 'ready',
    steps: Object.fromEntries(
      plan.map((node) => [
        node.id,
        fresh.has(node.id)
          ? { status: 'pending' as const, attempts: 0 }
          : structuredClone(initial.steps[node.id]),
      ]),
    ),
    artifacts: structuredClone(
      Object.fromEntries(Object.entries(initial.artifacts).filter(([key]) => inheritedKeys.has(key))),
    ),
    approvals: structuredClone(
      initial.approvals.filter((item) => inherited.some((node) => node.id === item.nodeId)),
    ),
    ...(initial.clarifications ? { clarifications: structuredClone(initial.clarifications) } : {}),
    ...(initial.reviewExclusions
      ? {
          reviewExclusions: structuredClone(
            initial.reviewExclusions.filter((item) => selected.has(item.nodeId)),
          ),
        }
      : {}),
  };
  const source: ReproductionSource = {
    version: 1,
    sourceRunId: initial.id,
    reportDigest,
    evidenceDigest: bundle.report.evidenceDigest,
    planDigest: bundle.execution.planDigest,
    candidateId,
    candidateTitle: bundle.candidate.title,
    testNames: bundle.candidate.testNames,
    scriptSha256: bundle.execution.scriptSha256,
    frameworkSha256: bundle.execution.frameworkSha256,
    targetUrl: bundle.framework.targetUrl,
    inheritedNodeIds: inherited.map((node) => node.id),
  };
  run.artifacts['reproduction.source'] = {
    type: 'ReproductionSource',
    value: source,
    digest: await digest(source),
  };
  return run;
}
