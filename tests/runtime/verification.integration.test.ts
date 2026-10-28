import { expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createGameTarget } from '../fixtures/blackbox/game-target.mjs';
import { advanceRun, approveRun } from '../../src/domain/runtime/engine';
import { latestArtifact } from '../../src/domain/runtime/bindings';
import { isEvidence, isReport } from '../../src/domain/execution/schema';
import { nativeExecutionPort } from './native-execution-port';
import { gameWorkflowFixture } from './game-workflow-fixture';

it.each([false, true])(
  'runs the complete approved workflow with real Python; reference=%s',
  async (fixed) => {
    const target = createGameTarget(fixed);
    await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
    const address = target.address();
    if (!address || typeof address === 'string') throw new Error('fixture address');
    const fixture = gameWorkflowFixture(`http://127.0.0.1:${address.port}`);
    const folder = path.resolve(`.runtime/workflow-validation/${fixed ? 'reference' : 'buggy'}`);
    mkdirSync(folder, { recursive: true });
    const execution = nativeExecutionPort(path.join(folder, 'executions'));
    let run = fixture.run;
    try {
      for (let gate = 0; gate < 4; gate++) {
        run = await advanceRun(
          run,
          fixture.agent,
          new AbortController().signal,
          fixture.update,
          () => {},
          execution,
        );
        expect(run.status, run.errorCode).toBe('awaiting_review');
        expect(latestArtifact(run, 'EvidenceBundle')).toBeUndefined();
        const node = run.plan.find((node) => run.steps[node.id].status === 'awaiting_review')!;
        run = await approveRun(run, node.id, run.steps[node.id].reviewDigest!);
        fixture.update(run);
      }
      run = await advanceRun(
        run,
        fixture.agent,
        new AbortController().signal,
        fixture.update,
        () => {},
        execution,
      );
      expect(run.status, run.errorCode).toBe('completed');
      expect(run.approvals).toHaveLength(4);
      expect(run.plan).toHaveLength(13);
      const evidence = latestArtifact(run, 'EvidenceBundle');
      const report = latestArtifact(run, 'VerificationReport');
      if (!isEvidence(evidence) || !isReport(report)) throw new Error('real evidence required');
      expect(evidence.results).toHaveLength(36);
      expect(evidence.requests.length).toBeGreaterThan(36);
      expect(report.counts.error).toBe(0);
      expect(report.counts.skipped).toBe(0);
      expect(report.status).toBe(fixed ? 'passed' : 'candidates_found');
      expect(fixture.operations).toEqual([
        'requirements.extract',
        'scenarios.design',
        'cases.generate',
        'cases.generate',
        'cases.generate',
        'cases.generate',
        'tests.implement',
        'verdicts.evaluate',
      ]);
      writeFileSync(path.join(folder, 'run.json'), JSON.stringify(run, null, 2));
      writeFileSync(path.join(folder, 'report.json'), JSON.stringify(report, null, 2));
    } finally {
      target.closeAllConnections();
      await new Promise<void>((resolve) => target.close(() => resolve()));
    }
  },
  60000,
);
