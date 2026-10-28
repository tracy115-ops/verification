import type { WorkflowNode } from '../workflow';
import type { WorkflowRun } from './types';

export function resolveInputs(run: WorkflowRun, node: WorkflowNode): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, input] of Object.entries(node.inputs)) {
    if (input.from === '$input.spec') result[key] = { text: run.spec };
    else if (input.from === '$input.context')
      result[key] = {
        contentLocale: run.snapshot.definition.contentLocale,
        blackBox: true,
        frameworkInstructions: run.executionProfile?.instructions ?? '',
      };
    else if (input.from === '$input.implementation') result[key] = run.executionProfile;
    else if (input.from === '$input.target') result[key] = run.executionProfile;
    else if (input.from === '$input.action_policy') result[key] = { mode: 'report_only' };
    else {
      const artifact = run.artifacts[input.from];
      if (!artifact || artifact.type !== input.type) throw new Error('artifact_reference_invalid');
      result[key] = artifact.value;
    }
  }
  return result;
}

export function latestArtifact(run: WorkflowRun, type: string): unknown {
  return Object.values(run.artifacts).find((artifact) => artifact.type === type)?.value;
}
