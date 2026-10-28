import type { WorkflowNode } from '../workflow';
import type { WorkflowRun } from './types';
import { resolveInputs } from './bindings';
import { digest } from './plan';

export async function reviewDigest(run: WorkflowRun, node: WorkflowNode): Promise<string> {
  const selected = new Set<string>();
  function select(id: string) {
    if (selected.has(id)) return;
    selected.add(id);
    run.plan.find((item) => item.id === id)?.dependsOn.forEach(select);
  }
  node.dependsOn.forEach(select);
  const upstream = Object.fromEntries(
    run.plan
      .filter((item) => selected.has(item.id))
      .flatMap((item) =>
        Object.keys(item.outputs).map((slot) => [`${item.id}.${slot}`, run.artifacts[`${item.id}.${slot}`]]),
      ),
  );
  return digest({
    snapshot: run.snapshot,
    spec: run.spec,
    executionProfile: run.executionProfile,
    nodeId: node.id,
    inputs: resolveInputs(run, node),
    ...(run.scope === 'verification' ? { upstream } : {}),
  });
}
