import type { RequirementArtifact } from './types';
import { decodeRequirements, isRequirementIncrement, requirementIncrementSchema } from './artifacts';
import { sourceWindows, byteLength } from './analysis-plan';
import { analysisCheckpoint, saveAnalysisBatch } from './analysis-checkpoint';
import { callAnalysis, scopedTask, type AnalysisContext } from './analysis-call';
import { mergeRequirements, prefixRequirements } from './analysis-merge';
import { digest } from './plan';

function validateBatch(value: unknown, spec: string, window: string): RequirementArtifact {
  if (!isRequirementIncrement(value)) throw new Error('artifact_invalid');
  const validated = value.requirements.length ? decodeRequirements(value, spec) : structuredClone(value);
  if (validated.requirements.some((item) => !window.includes(item.quote)))
    throw new Error('source_quote_invalid');
  return validated;
}

export async function extractRequirementBatches(
  context: AnalysisContext,
  inputs: Record<string, unknown>,
): Promise<RequirementArtifact> {
  const { run, node, profile, onUpdate } = context;
  const windows = sourceWindows(run.spec);
  const checkpoint = await analysisCheckpoint(
    run,
    node,
    profile,
    'requirements',
    windows.length,
    windows.length,
    inputs,
  );
  for (const saved of checkpoint.completed) validateBatch(saved.value, run.spec, windows[saved.index].text);
  for (let index = 0; index < windows.length; index++) {
    if (checkpoint.completed.some((item) => item.index === index)) continue;
    const window = windows[index];
    const task = scopedTask(run, node, inputs, window.text);
    task.outputSchema = requirementIncrementSchema;
    task.analysisBatch = {
      version: 1,
      phase: 'requirements',
      index: index + 1,
      total: windows.length,
      sourceStart: window.start,
      sourceEnd: window.end,
      sectionPath: window.sectionPath,
    };
    task.instruction +=
      ' Analyze only this exact source window, including its boundary context. Extract atomic observable requirements using short unique literal quotes. Do not invent obligations from headings or introductory prose; requirements may be empty when this window contains no rules. Do not generate scenarios or test cases yet. Use compact IDs. Return all distinct rules within this window.';
    if (checkpoint.rejected?.index === index)
      task.validationFeedback = {
        code: 'source_quote_invalid',
        instruction:
          'The previous batch had an invalid or ambiguous quote. Copy unique literal source spans and regenerate this batch only.',
      };
    const parsed = await callAnalysis(context, task);
    if (!isRequirementIncrement(parsed)) throw new Error('artifact_invalid');
    const prefixed = prefixRequirements(parsed, index);
    let value: RequirementArtifact;
    try {
      value = validateBatch(prefixed, run.spec, window.text);
    } catch (error) {
      if (
        error instanceof Error &&
        ['source_quote_invalid', 'source_quote_ambiguous'].includes(error.message)
      ) {
        if (byteLength(JSON.stringify({ ...checkpoint, rejected: { index, value: prefixed } })) > 256_000)
          throw new Error('analysis_checkpoint_full');
        checkpoint.rejected = { index, value: prefixed };
        const partial = mergeRequirements([
          ...checkpoint.completed.map((item) => item.value as RequirementArtifact),
          prefixed,
        ]);
        run.artifacts[`${node.id}.${Object.keys(node.outputs)[0]}`] = {
          type: 'RequirementBaselineDraft',
          value: partial,
          digest: await digest(partial),
        };
        onUpdate(structuredClone(run));
      }
      throw error;
    }
    await saveAnalysisBatch(checkpoint, index, value);
    delete checkpoint.rejected;
    onUpdate(structuredClone(run));
  }
  return decodeRequirements(
    mergeRequirements(
      checkpoint.completed
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((item) => item.value as RequirementArtifact),
    ),
    run.spec,
  );
}
