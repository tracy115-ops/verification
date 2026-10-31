import type { WorkflowRun } from './types';
import { decodeRequirements, isRequirements } from './artifacts';
import { digest } from './plan';
import { sourceWindows } from './analysis-plan';
import { saveAnalysisBatch } from './analysis-checkpoint';

export async function repairRequirementQuotes(initial: WorkflowRun, quotes: Record<string, string>) {
  const run = structuredClone(initial);
  const node = run.plan.find((item) => item.operation === 'requirements.extract');
  if (
    !node ||
    run.status !== 'failed' ||
    !['source_quote_invalid', 'source_quote_ambiguous'].includes(run.steps[node.id].errorCode ?? '')
  )
    throw new Error('approval_invalid');
  const key = `${node.id}.${Object.keys(node.outputs)[0]}`;
  const artifact = run.artifacts[key];
  if (!isRequirements(artifact?.value)) throw new Error('artifact_invalid');
  const previous = artifact.value;
  if (Object.keys(quotes).some((id) => !previous.requirements.some((item) => item.id === id)))
    throw new Error('artifact_invalid');
  const value = decodeRequirements(
    {
      ...previous,
      requirements: previous.requirements.map((item) => ({
        ...item,
        quote: Object.hasOwn(quotes, item.id) ? quotes[item.id] : item.quote,
      })),
    },
    run.spec,
  );
  const nextDigest = await digest(value);
  const auditKey = `quote-repair.${crypto.randomUUID()}`;
  const audit = {
    at: new Date().toISOString(),
    beforeDigest: artifact.digest,
    afterDigest: nextDigest,
    changes: value.requirements
      .filter(
        (item) => item.quote !== previous.requirements.find((previous) => previous.id === item.id)?.quote,
      )
      .map((item) => ({
        id: item.id,
        before: previous.requirements.find((previous) => previous.id === item.id)?.quote,
        after: item.quote,
      })),
  };
  run.artifacts[auditKey] = { type: 'RequirementQuoteRepair', value: audit, digest: await digest(audit) };
  run.artifacts[key] = { ...artifact, value, digest: nextDigest };
  const checkpoint = run.steps[node.id].analysis;
  if (checkpoint) {
    const rejected = checkpoint.rejected;
    if (
      checkpoint.kind !== 'requirements' ||
      !rejected ||
      checkpoint.completed.some((item) => item.index === rejected.index)
    )
      throw new Error('artifact_invalid');
    const repaired = decodeRequirements(
      {
        ...rejected.value,
        requirements: rejected.value.requirements.map((item) => {
          const requirement = value.requirements.find((next) => next.id === item.id);
          if (!requirement) throw new Error('artifact_invalid');
          return requirement;
        }),
      },
      run.spec,
    );
    const window = sourceWindows(run.spec)[rejected.index];
    if (!window || repaired.requirements.some((item) => !window.text.includes(item.quote)))
      throw new Error('source_quote_invalid');
    await saveAnalysisBatch(checkpoint, rejected.index, repaired);
    delete checkpoint.rejected;
  }
  run.steps[node.id].status = checkpoint ? 'pending' : 'succeeded';
  delete run.steps[node.id].errorCode;
  delete run.errorCode;
  run.resumedAt = new Date().toISOString();
  run.status = 'ready';
  return run;
}
