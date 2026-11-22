import { expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { reproductionRunFixture } from './reproduction-run-fixture';
import { createReproductionRun } from '../../src/domain/runtime/reproduction-run';
import { reproductionObservations } from '../../src/domain/runtime/reproduction-observations';
import { advanceRun, approveRun } from '../../src/domain/runtime/engine';
import { latestArtifact } from '../../src/domain/runtime/bindings';
import type { AgentPort } from '../../src/domain/runtime/types';
import type { EvidenceBundle } from '../../src/domain/execution/types';

it('runs approved replays with real Python, fresh evidence and environment-matched observations', async () => {
  const root = path.resolve('.runtime/reproduction-run-integration');
  mkdirSync(root, { recursive: true });
  const fixture = await reproductionRunFixture(root);
  const original = structuredClone(fixture.source);
  const agent: AgentPort = {
    send: vi.fn(async () => {
      throw new Error('unexpected_model_call');
    }),
    cancel: async () => {},
  };
  const runs = [fixture.source];
  try {
    for (let index = 0; index < 3; index++) {
      fixture.setFixed(index === 2);
      let run = await createReproductionRun(fixture.source, fixture.reportDigest, fixture.candidateId);
      run = await advanceRun(
        run,
        agent,
        new AbortController().signal,
        () => {},
        () => {},
        fixture.port,
      );
      expect(run.status, run.errorCode).toBe('awaiting_review');
      expect(latestArtifact(run, 'EvidenceBundle')).toBeUndefined();
      const review = run.plan.find((node) => node.operation === 'review.execution')!;
      run = await approveRun(run, review.id, run.steps[review.id].reviewDigest!);
      run = await advanceRun(
        run,
        agent,
        new AbortController().signal,
        () => {},
        () => {},
        fixture.port,
      );
      expect(run.status, run.errorCode).toBe('completed');
      const evidence = latestArtifact(run, 'EvidenceBundle') as EvidenceBundle;
      expect(evidence.results.filter((item) => item.status === 'error')).toEqual([]);
      expect(evidence.results.filter((item) => item.status === 'failed')).toHaveLength(index === 2 ? 0 : 1);
      runs.push(run);
      expect(reproductionObservations(run, runs)[0].status).toBe(
        ['observed_failure', 'repeated_failure', 'intermittent'][index],
      );
    }
    expect(fixture.source).toEqual(original);
    expect(agent.send).not.toHaveBeenCalled();
    writeFileSync(path.join(root, 'runs.json'), JSON.stringify(runs, null, 2));
  } finally {
    await fixture.close();
  }
});
