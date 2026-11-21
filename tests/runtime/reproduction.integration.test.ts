import { expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { reportRunFixture } from '../fixtures/report-run';
import { createGameTarget } from '../fixtures/blackbox/game-target.mjs';
import { candidateReproduction } from '../../src/domain/runtime/candidate-reproduction';
import { nativeExecutionPort } from './native-execution-port';
import type { VerificationReport } from '../../src/domain/execution/types';

it.each([true, false])(
  'executes exported suite three times against a controlled target; reference=%s',
  async (fixed) => {
    const run = reportRunFixture();
    const report = Object.values(run.artifacts).find((item) => item.type === 'VerificationReport')!;
    const candidateId = (report.value as VerificationReport).candidates[0].id;
    const bundle = await candidateReproduction(run, report.digest, candidateId);
    const root = path.resolve(`.runtime/reproduction-integration/${fixed ? 'reference' : 'defect'}`);
    mkdirSync(root, { recursive: true });
    const port = nativeExecutionPort(path.join(root, 'executions'));
    const target = createGameTarget(fixed);
    await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
    const address = target.address();
    if (!address || typeof address === 'string') throw new Error('fixture_address');
    const signal = new AbortController().signal;
    const results = [];
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const plan = await port.preflight(
          {
            sessionId: crypto.randomUUID(),
            runId: crypto.randomUUID(),
            executionId: crypto.randomUUID(),
            implementation: bundle.implementation,
            profile: { ...bundle.framework, targetUrl: `http://127.0.0.1:${address.port}` },
          },
          signal,
        );
        expect(plan.scriptSha256).toBe(bundle.execution.scriptSha256);
        expect(plan.frameworkSha256).toBe(bundle.execution.frameworkSha256);
        const evidence = await port.execute(plan, plan.digest, signal);
        expect(evidence.results).toHaveLength(bundle.implementation.tests.length);
        expect(
          evidence.results.filter((item) => item.status === 'error' || item.status === 'skipped'),
        ).toEqual([]);
        expect(
          evidence.results
            .filter((item) => item.status === 'failed')
            .map((item) => item.testName)
            .sort(),
        ).toEqual(fixed ? [] : [...bundle.candidate.testNames].sort());
        expect(evidence.requests.length).toBeGreaterThan(0);
        writeFileSync(path.join(root, `evidence-${attempt}.json`), JSON.stringify(evidence, null, 2));
        results.push({
          attempt,
          results: evidence.results.map(({ testName, status }) => ({ testName, status })),
          scriptSha256: plan.scriptSha256,
          frameworkSha256: plan.frameworkSha256,
          rawEvidenceSha256: evidence.rawEvidenceSha256,
        });
      }
      writeFileSync(path.join(root, 'replays.json'), JSON.stringify(results, null, 2));
    } finally {
      target.closeAllConnections();
      await new Promise<void>((resolve) => target.close(() => resolve()));
    }
  },
);
