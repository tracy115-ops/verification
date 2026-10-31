import type { AgentProfile, WorkflowNode } from '../workflow';
import type { AgentEvent, AgentPort, WorkflowRun } from './types';
import { newId } from '../../shared/id';
import { inferenceModel } from './profile';
import { remainingNodeSeconds } from './deadline';
import { ANALYSIS_PROMPT_LIMIT, byteLength } from './analysis-plan';
import { parseArtifact } from './artifacts';
import { taskFor } from './handlers';

export interface AnalysisContext {
  run: WorkflowRun;
  node: WorkflowNode;
  profile: AgentProfile;
  port: AgentPort;
  signal: AbortSignal;
  onUpdate: (run: WorkflowRun) => void;
  onEvent: (event: AgentEvent) => void;
}

export function scopedTask(
  run: WorkflowRun,
  node: WorkflowNode,
  inputs: Record<string, unknown>,
  source: string,
) {
  const scoped = { ...run, spec: source, artifacts: { ...run.artifacts } };
  delete scoped.artifacts[`${node.id}.${Object.keys(node.outputs)[0]}`];
  const values = { ...inputs };
  for (const [key, contract] of Object.entries(node.inputs))
    if (contract.type === 'DocumentRevision') values[key] = { text: source, revision: 1 };
  return JSON.parse(taskFor(scoped, node, values)) as Record<string, unknown> & { instruction: string };
}

export async function callAnalysis(context: AnalysisContext, task: object, cross = false): Promise<unknown> {
  const { run, node, profile, port, signal, onUpdate, onEvent } = context;
  if (signal.aborted) throw new Error('execution_cancelled');
  const prompt = JSON.stringify(task);
  if (byteLength(prompt) > ANALYSIS_PROMPT_LIMIT) throw new Error('analysis_request_too_large');
  const step = run.steps[node.id];
  step.turnId = newId();
  onEvent({ type: 'activity', name: cross ? 'analysis_cross_review' : 'analysis_batch' });
  onUpdate(structuredClone(run));
  const result = await port.send(
    {
      turnId: step.turnId,
      sessionId: run.sessionId,
      driver: profile.driver,
      model: inferenceModel(profile),
      prompt,
      timeoutSeconds: remainingNodeSeconds(run, node),
    },
    onEvent,
    signal,
  );
  step.nativeSessionId = result.nativeSessionId ?? undefined;
  if (signal.aborted) throw new Error('execution_cancelled');
  if (result.status !== 'completed') throw new Error(result.errorCode ?? 'cli_failed');
  return parseArtifact(result.text);
}
