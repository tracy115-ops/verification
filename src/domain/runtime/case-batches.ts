import type { WorkflowNode, AgentProfile } from '../workflow';
import type { WorkflowRun, AgentPort, AgentEvent, CaseArtifact } from './types';
import { isDesign, parseArtifact, decodeCases } from './artifacts';
import { digest } from './plan';
import { newId } from '../../shared/id';
import { inferenceModel } from './profile';
import { taskFor, validateTaskArtifact } from './handlers';
import { latestArtifact } from './bindings';
import { decodeRequirements } from './artifacts';
import { remainingNodeSeconds } from './deadline';

export const CASE_BATCH_SIZE = 3;
export async function generateCaseBatches(
  run: WorkflowRun,
  node: WorkflowNode,
  inputs: Record<string, unknown>,
  profile: AgentProfile,
  port: AgentPort,
  signal: AbortSignal,
  onUpdate: (run: WorkflowRun) => void,
  onEvent: (event: AgentEvent) => void,
): Promise<CaseArtifact> {
  const inputKey = Object.keys(node.inputs).find((key) => node.inputs[key].type === 'TestDesign');
  const design = inputKey ? inputs[inputKey] : undefined;
  if (!isDesign(design)) throw new Error('artifact_invalid');
  const signature = await digest({
    design,
    spec: run.spec,
    profile,
    node,
    snapshot: run.snapshot,
    clarifications: run.clarifications,
    reviewExclusions: run.reviewExclusions,
  });
  const step = run.steps[node.id];
  if (step.caseBatches?.some((item) => item.signature !== signature)) throw new Error('approval_stale');
  const batches = step.caseBatches ?? [];
  const groups = Array.from({ length: Math.ceil(design.scenarios.length / CASE_BATCH_SIZE) }, (_, index) =>
    design.scenarios.slice(index * CASE_BATCH_SIZE, (index + 1) * CASE_BATCH_SIZE),
  );
  if (
    new Set(batches.map((item) => item.index)).size !== batches.length ||
    batches.some((item) => !groups[item.index])
  )
    throw new Error('artifact_invalid');
  const requirements = decodeRequirements(latestArtifact(run, 'RequirementBaseline'), run.spec);
  for (const batch of batches) {
    decodeCases(batch.cases, requirements, design);
    const ids = new Set(groups[batch.index].map((item) => item.id));
    if (batch.cases.cases.some((item) => item.scenarioIds.some((id) => !ids.has(id))))
      throw new Error('artifact_invalid');
  }
  for (let index = 0; index < groups.length; index++) {
    if (signal.aborted) throw new Error('execution_cancelled');
    if (batches.some((item) => item.index === index)) continue;
    const scenarios = groups[index];
    const batchInputs = { ...inputs, [inputKey!]: { ...design, scenarios } };
    step.turnId = newId();
    step.caseBatchAttempts = (step.caseBatchAttempts ?? 0) + 1;
    onUpdate(structuredClone(run));
    const task = JSON.parse(taskFor(run, node, batchInputs));
    task.batch = {
      index: index + 1,
      total: groups.length,
      allowedScenarioIds: scenarios.map((item) => item.id),
      allowedRequirementIdsByScenario: Object.fromEntries(
        scenarios.map((item) => [item.id, item.requirementIds]),
      ),
    };
    task.instruction +=
      ' Generate cases only for the listed allowedScenarioIds. Cover each listed scenario; do not output cases for other scenarios. Use unique case IDs within this batch. Each case requirementIds must be a nonempty subset of the union of requirementIds mapped by its scenarioIds in allowedRequirementIdsByScenario. Do not cite unrelated requirements even if they describe a related endpoint. Framework and delivery constraints must be expressed as preconditions or acceptance criteria on observable business tests, not separate tests that inspect files, imports or framework internals.';
    const request = {
      turnId: step.turnId,
      sessionId: run.sessionId,
      driver: profile.driver,
      prompt: JSON.stringify(task),
      model: inferenceModel(profile),
      timeoutSeconds: remainingNodeSeconds(run, node),
    };
    const result = await port.send(request, onEvent, signal);
    step.nativeSessionId = result.nativeSessionId ?? undefined;
    if (result.status !== 'completed') throw new Error(result.errorCode ?? 'cli_failed');
    const cases = validateTaskArtifact(run, node, parseArtifact(result.text)) as CaseArtifact;
    const ids = new Set(scenarios.map((item) => item.id));
    if (cases.cases.some((item) => item.scenarioIds.some((id) => !ids.has(id))))
      throw new Error('artifact_invalid');
    const prefix = `B${index + 1}-`;
    const normalized = {
      cases: cases.cases.map((item) => ({
        ...item,
        id: groups.length === 1 ? item.id : `${prefix}${item.id}`,
      })),
    };
    if (normalized.cases.some((item) => item.id.length > 80)) throw new Error('artifact_invalid');
    batches.push({ signature, index, cases: normalized });
    step.caseBatches = batches;
    step.caseBatchAttempts = 0;
    onUpdate(structuredClone(run));
  }
  const combined = {
    cases: batches
      .slice()
      .sort((a, b) => a.index - b.index)
      .flatMap((item) => item.cases.cases),
  };
  return decodeCases(combined, requirements, design);
}
