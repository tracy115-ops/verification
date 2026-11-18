import { expect, it, vi } from 'vitest';
import { recoverDesignDiagnostics } from './design-diagnostic-recovery';
import { transcriptStore } from './transcript-store';
import { advanceRun, approveRun } from '../domain/runtime/engine';
import { fixtureRun, fixturePort, design } from '../domain/runtime/fixtures.test-support';
import type { CliTurnRecord } from '../domain/runtime/transcript';

vi.mock('./transcript-store', () => ({ transcriptStore: { load: vi.fn(), getSnapshot: vi.fn() } }));

it('recovers diagnostics from the exact historical turn without accepting it as a design', async () => {
  const initial = await advanceRun(
    fixtureRun(),
    fixturePort().port,
    new AbortController().signal,
    () => {},
    () => {},
  );
  const review = initial.plan.find((item) => item.operation === 'review.requirements')!;
  const run = await approveRun(initial, review.id, initial.steps[review.id].reviewDigest!);
  const node = run.plan.find((item) => item.operation === 'scenarios.design')!;
  run.status = 'failed';
  run.steps[node.id].status = 'failed';
  run.steps[node.id].errorCode = 'artifact_invalid';
  run.steps[node.id].turnId = crypto.randomUUID();
  const invalid = structuredClone(design);
  invalid.factors[0].sourceQuote = 'Source paragraph outside the linked requirement';
  const record: CliTurnRecord = {
    version: 1,
    id: run.steps[node.id].turnId!,
    sessionId: run.sessionId,
    runId: run.id,
    nodeId: node.id,
    operation: node.operation,
    request: {
      turnId: run.steps[node.id].turnId!,
      sessionId: run.sessionId,
      driver: 'codex',
      model: 'fixture',
      prompt: '{}',
      timeoutSeconds: 600,
    },
    status: 'completed',
    text: JSON.stringify(invalid),
    activities: [],
    startedAt: new Date().toISOString(),
  };
  vi.mocked(transcriptStore.getSnapshot).mockReturnValue({ records: [record], error: null });
  const recovered = await recoverDesignDiagnostics(run);
  expect(recovered.steps[node.id].designQuoteIssues).toEqual([
    { factorId: 'F-1', requirementIds: ['REQ-1'] },
  ]);
  expect(recovered.artifacts).toEqual(run.artifacts);
  expect(run.steps[node.id].designQuoteIssues).toBeUndefined();
  for (const key of ['nodeId', 'sessionId', 'runId', 'id'] as const) {
    vi.mocked(transcriptStore.getSnapshot).mockReturnValue({
      records: [{ ...record, [key]: 'wrong' }],
      error: null,
    });
    expect(await recoverDesignDiagnostics(run)).toBe(run);
  }
  vi.mocked(transcriptStore.getSnapshot).mockReturnValue({
    records: [{ ...record, text: 'malformed JSON' }],
    error: null,
  });
  expect(await recoverDesignDiagnostics(run)).toBe(run);
});
