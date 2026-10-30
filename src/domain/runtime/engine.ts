import type { WorkflowNode } from '../workflow';
import { newId } from '../../shared/id';
import { parseArtifact } from './artifacts';
import { resolveInputs } from './bindings';
import { reviewIssues, taskFor, validateTaskArtifact } from './handlers';
import { digest } from './plan';
import { inferenceModel } from './profile';
import type { AgentEvent, AgentPort, WorkflowRun } from './types';
import type { ExecutionPort } from '../execution/types';
import { executeSystemStep } from './execution';
import { decodePlan } from '../execution/validation';
import { latestArtifact } from './bindings';
import { reviewDigest } from './approvals';
import { generateCaseBatches } from './case-batches';
import { remainingNodeSeconds, runDeadline } from './deadline';
import { scopedCases } from './case-scope';
import { isCases, isRequirements } from './artifacts';
export { reviewDigest } from './approvals';

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
  executionPort?: ExecutionPort,
): Promise<WorkflowRun> {
  const run = structuredClone(initial);
  run.status = 'running';
  while (!signal.aborted) {
    if (Date.now() > runDeadline(run)) {
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
        if (signal.aborted) throw new Error('execution_cancelled');
        run.status = 'awaiting_review';
        onUpdate(structuredClone(run));
        return run;
      }
      step.status = 'running';
      step.attempts++;
      if (node.operation === 'documents.import') {
        await storeOutput(run, node, { text: run.spec, revision: 1 });
      } else if (['targets.preflight', 'targets.execute', 'actions.dispatch'].includes(node.operation)) {
        if (node.operation === 'targets.preflight') step.executionId = newId();
        if (node.operation === 'targets.execute')
          step.executionId = decodePlan(latestArtifact(run, 'ExecutionPlan')).payload.executionId;
        onUpdate(structuredClone(run));
        await storeOutput(run, node, await executeSystemStep(run, node, executionPort, signal));
      } else {
        const profileId = run.snapshot.bindings[node.id] ?? run.defaultProfileId;
        const profile = run.profiles.find((profile) => profile.id === profileId);
        if (!profile || profile.protocol !== 'native') throw new Error('unsupported_profile');
        if (node.operation === 'cases.generate') {
          await storeOutput(
            run,
            node,
            await generateCaseBatches(run, node, inputs, profile, port, signal, onUpdate, onEvent),
          );
          step.status = 'succeeded';
          onUpdate(structuredClone(run));
          continue;
        }
        step.turnId = newId();
        onUpdate(structuredClone(run));
        const result = await port.send(
          {
            turnId: step.turnId,
            sessionId: run.sessionId,
            driver: profile.driver,
            prompt: taskFor(run, node, inputs),
            model: inferenceModel(profile),
            timeoutSeconds: remainingNodeSeconds(run, node),
          },
          onEvent,
          signal,
        );
        step.nativeSessionId = result.nativeSessionId ?? undefined;
        if (result.status !== 'completed') throw new Error(result.errorCode ?? 'cli_failed');
        const parsed = parseArtifact(result.text);
        try {
          await storeOutput(run, node, validateTaskArtifact(run, node, parsed));
        } catch (error) {
          if (
            node.operation === 'requirements.extract' &&
            isRequirements(parsed) &&
            error instanceof Error &&
            ['source_quote_invalid', 'source_quote_ambiguous'].includes(error.message)
          )
            await storeOutput(run, node, parsed);
          throw error;
        }
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
  if (Date.now() > runDeadline(run)) throw new Error('run_deadline');
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
  if (!['review.custom', 'review.execution'].includes(node.operation) && !inputKey)
    throw new Error('approval_invalid');
  const reviewed = inputKey ? resolveInputs(run, node)[inputKey] : undefined;
  await storeOutput(
    run,
    node,
    node.operation === 'review.execution'
      ? { planDigest: decodePlan(latestArtifact(run, 'ExecutionPlan')).digest, reviewDigest: expectedDigest }
      : node.operation === 'review.custom'
        ? { approved: true }
        : node.operation === 'review.cases' && isCases(reviewed)
          ? scopedCases(run, reviewed)
          : reviewed,
  );
  run.steps[nodeId].status = 'succeeded';
  run.approvals.push({ nodeId, digest: expectedDigest, approvedAt: new Date().toISOString() });
  run.status = 'ready';
  return run;
}

export function retryRun(initial: WorkflowRun): WorkflowRun {
  if (!['failed', 'interrupted'].includes(initial.status)) throw new Error('invalid_run');
  const run = structuredClone(initial);
  const node =
    run.plan.find((node) => ['failed', 'interrupted'].includes(run.steps[node.id].status)) ??
    (run.errorCode === 'run_deadline'
      ? run.plan.find((node) => ['pending', 'awaiting_review'].includes(run.steps[node.id].status))
      : undefined);
  if (!node) throw new Error('invalid_run');
  run.resumedAt = new Date().toISOString();
  run.steps[node.id].status = 'pending';
  delete run.steps[node.id].errorCode;
  delete run.errorCode;
  run.status = 'ready';
  return run;
}
