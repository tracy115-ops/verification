import type { WorkflowNode } from '../workflow';
import { newId } from '../../shared/id';
import { parseArtifact } from './artifacts';
import { resolveInputs } from './bindings';
import { reviewIssues, taskFor, validateTaskArtifact } from './handlers';
import { digest } from './plan';
import { inferenceModel } from './profile';
import type { AgentEvent, AgentPort, WorkflowRun } from './types';

export async function reviewDigest(run: WorkflowRun, node: WorkflowNode): Promise<string> {
  return digest({
    snapshot: run.snapshot,
    spec: run.spec,
    nodeId: node.id,
    inputs: resolveInputs(run, node),
  });
}

async function storeOutput(run: WorkflowRun, node: WorkflowNode, value: unknown) {
  const outputs = Object.entries(node.outputs);
  if (outputs.length !== 1) throw new Error('unsupported_workflow');
  const [slot, type] = outputs[0];
  run.artifacts[`${node.id}.${slot}`] = { type, value: structuredClone(value), digest: await digest(value) };
}

export async function advanceRun(
  initial: WorkflowRun,
  port: AgentPort,
  signal: AbortSignal,
  onUpdate: (run: WorkflowRun) => void,
  onEvent: (event: AgentEvent) => void,
): Promise<WorkflowRun> {
  const run = structuredClone(initial);
  run.status = 'running';
  while (!signal.aborted) {
    if (Date.now() > Date.parse(run.createdAt) + run.snapshot.definition.limits.deadlineSeconds * 1000) {
      run.status = 'failed';
      run.errorCode = 'run_deadline';
      break;
    }
    const node = run.plan.find(
      (node) =>
        run.steps[node.id].status === 'pending' &&
        node.dependsOn.every((id) => run.steps[id]?.status === 'succeeded'),
    );
    if (!node) {
      run.status = Object.values(run.steps).every((step) => step.status === 'succeeded')
        ? 'completed'
        : 'failed';
      if (run.status === 'failed') run.errorCode = 'invalid_run';
      break;
    }
    const step = run.steps[node.id];
    try {
      const inputs = resolveInputs(run, node);
      if (node.kind === 'human') {
        step.status = 'awaiting_review';
        step.reviewDigest = await reviewDigest(run, node);
        run.status = 'awaiting_review';
        onUpdate(structuredClone(run));
        return run;
      }
      step.status = 'running';
      step.attempts++;
      if (node.operation === 'documents.import') {
        await storeOutput(run, node, { text: run.spec, revision: 1 });
      } else {
        const profileId = run.snapshot.bindings[node.id] ?? run.defaultProfileId;
        const profile = run.profiles.find((profile) => profile.id === profileId);
        if (!profile || profile.protocol !== 'native') throw new Error('unsupported_profile');
        step.turnId = newId();
        onUpdate(structuredClone(run));
        const result = await port.send(
          {
            turnId: step.turnId,
            sessionId: run.sessionId,
            driver: profile.driver,
            prompt: taskFor(run, node, inputs),
            model: inferenceModel(profile),
            timeoutSeconds: Math.min(node.policy.timeoutSeconds, 600),
          },
          onEvent,
          signal,
        );
        step.nativeSessionId = result.nativeSessionId ?? undefined;
        if (result.status !== 'completed') throw new Error(result.errorCode ?? 'cli_failed');
        await storeOutput(run, node, validateTaskArtifact(run, node, parseArtifact(result.text)));
      }
      step.status = 'succeeded';
      onUpdate(structuredClone(run));
    } catch (error) {
      step.status = signal.aborted ? 'interrupted' : 'failed';
      step.errorCode = error instanceof Error ? error.message : 'cli_failed';
      run.status = signal.aborted ? 'cancelled' : 'failed';
      run.errorCode = step.errorCode;
      break;
    }
  }
  if (signal.aborted) run.status = 'cancelled';
  onUpdate(structuredClone(run));
  return run;
}

export async function approveRun(
  initial: WorkflowRun,
  nodeId: string,
  expectedDigest: string,
): Promise<WorkflowRun> {
  const run = structuredClone(initial);
  const node = run.plan.find((node) => node.id === nodeId);
  if (run.status !== 'awaiting_review' || !node || run.steps[nodeId].status !== 'awaiting_review')
    throw new Error('approval_invalid');
  if (expectedDigest !== run.steps[nodeId].reviewDigest || expectedDigest !== (await reviewDigest(run, node)))
    throw new Error('approval_stale');
  if (reviewIssues(run, node).length) throw new Error('review_unresolved');
  const draftTypes: Record<string, string> = {
    'review.requirements': 'RequirementBaselineDraft',
    'review.coverage': 'TestDesignDraft',
    'review.cases': 'TestCaseSetDraft',
  };
  const inputKey = Object.keys(node.inputs).find(
    (key) => node.inputs[key].type === draftTypes[node.operation],
  );
  if (node.operation !== 'review.custom' && !inputKey) throw new Error('approval_invalid');
  await storeOutput(
    run,
    node,
    node.operation === 'review.custom' ? { approved: true } : resolveInputs(run, node)[inputKey!],
  );
  run.steps[nodeId].status = 'succeeded';
  run.approvals.push({ nodeId, digest: expectedDigest, approvedAt: new Date().toISOString() });
  run.status = 'ready';
  return run;
}

export function retryRun(initial: WorkflowRun): WorkflowRun {
  if (!['failed', 'interrupted'].includes(initial.status)) throw new Error('invalid_run');
  const run = structuredClone(initial);
  const node = run.plan.find((node) => ['failed', 'interrupted'].includes(run.steps[node.id].status));
  if (!node || run.steps[node.id].attempts >= node.policy.maxAttempts) throw new Error('retry_limit');
  run.steps[node.id].status = 'pending';
  delete run.steps[node.id].errorCode;
  delete run.errorCode;
  run.status = 'ready';
  return run;
}
