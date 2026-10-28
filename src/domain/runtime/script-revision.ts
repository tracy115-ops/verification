import { latestArtifact } from './bindings';
import { digest } from './plan';
import { isImplementation } from '../execution/schema';
import type { WorkflowRun } from './types';

export async function resolveScriptQuestions(
  initial: WorkflowRun,
  expectedDigest: string,
  answers: Record<string, string>,
): Promise<WorkflowRun> {
  const run = structuredClone(initial);
  const implementation = run.plan.find((node) => node.operation === 'tests.implement');
  const preflight = run.plan.find((node) => node.operation === 'targets.preflight');
  const slot = implementation && Object.keys(implementation.outputs)[0];
  const key = implementation && `${implementation.id}.${slot}`;
  const artifact = key && run.artifacts[key];
  if (
    !implementation ||
    !preflight ||
    !artifact ||
    !isImplementation(artifact.value) ||
    run.status !== 'failed' ||
    run.steps[preflight.id].status !== 'failed' ||
    run.steps[preflight.id].errorCode !== 'review_unresolved' ||
    Object.values(run.artifacts).some((item) => ['ExecutionPlan', 'EvidenceBundle'].includes(item.type))
  )
    throw new Error('approval_invalid');
  if (expectedDigest !== artifact.digest || expectedDigest !== (await digest(artifact.value)))
    throw new Error('approval_stale');
  const questions = [...new Set(artifact.value.questions)];
  if (
    !questions.length ||
    questions.some((question) => !answers[question]?.trim() || answers[question].trim().length > 12000) ||
    Object.keys(answers).some((question) => !questions.includes(question))
  )
    throw new Error('review_unresolved');
  const revisionCount = Object.values(run.artifacts).filter(
    (item) => item.type === 'ImplementationRevision',
  ).length;
  if (revisionCount >= 2) throw new Error('retry_limit');
  const history = {
    artifact: structuredClone(artifact),
    answers: questions.map((question) => ({ question, answer: answers[question].trim() })),
    recordedAt: new Date().toISOString(),
  };
  run.artifacts[`history.implementation.${revisionCount + 1}.${artifact.digest}`] = {
    type: 'ImplementationRevision',
    value: history,
    digest: await digest(history),
  };
  const merged = new Map(
    [...implementationClarifications(run), ...history.answers].map((item) => [item.question, item]),
  );
  if (merged.size > 200) throw new Error('approval_invalid');
  const context = { answers: [...merged.values()] };
  run.artifacts['implementation.clarifications'] = {
    type: 'ImplementationClarifications',
    value: context,
    digest: await digest(context),
  };
  run.steps[implementation.id] = { status: 'pending', attempts: 0 };
  run.steps[preflight.id] = { status: 'pending', attempts: 0 };
  run.status = 'ready';
  delete run.errorCode;
  return run;
}

export function implementationClarifications(run: WorkflowRun): { question: string; answer: string }[] {
  const value = latestArtifact(run, 'ImplementationClarifications');
  if (value === undefined) return [];
  if (
    !value ||
    typeof value !== 'object' ||
    !('answers' in value) ||
    !Array.isArray(value.answers) ||
    value.answers.length > 200 ||
    value.answers.some(
      (item: unknown) =>
        !item ||
        typeof item !== 'object' ||
        !('question' in item) ||
        !('answer' in item) ||
        typeof item.question !== 'string' ||
        typeof item.answer !== 'string' ||
        !item.answer.trim() ||
        item.question.length > 12000 ||
        item.answer.length > 12000,
    )
  )
    throw new Error('artifact_invalid');
  return value.answers;
}
