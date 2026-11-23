import { expect, it } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createOrderTarget } from '../fixtures/blackbox/order-target.mjs';
import { nativeExecutionPort } from './native-execution-port';
import { decodeRequirements, decodeDesign, decodeCases } from '../../src/domain/runtime/artifacts';
import { decodeImplementation } from '../../src/domain/execution/validation';

it('replays the newly generated five-step journey on correct and rejected-payment mutation targets', async () => {
  const archive = path.resolve('docs/examples/generated/scenario-journey-2026-11-22');
  const source: Record<string, unknown> = JSON.parse(
    readFileSync(path.join(archive, 'model-output.json'), 'utf8'),
  );
  const spec = readFileSync(path.join(archive, 'focused-topic.md'), 'utf8');
  const requirements = decodeRequirements(source.requirements, spec);
  const design = decodeDesign(source.design, requirements);
  const cases = decodeCases(source.cases, requirements, design);
  const implementation = decodeImplementation(source.implementation, cases);
  expect(design.scenarios.filter((item) => item.journey)).toHaveLength(1);
  expect(design.scenarios[0].journey!.steps).toHaveLength(5);
  const framework = readFileSync('tests/fixtures/blackbox/framework.py', 'utf8').replace(
    'user="player-a"',
    'user="user-a"',
  );
  const results = [];
  for (const defect of [null, 'declined_payment_commit'] as const) {
    const target = createOrderTarget(defect);
    await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
    const address = target.address();
    if (!address || typeof address === 'string') throw new Error('fixture_address');
    const root = path.resolve(`.runtime/journey-contract/${defect ?? 'reference'}`);
    mkdirSync(root, { recursive: true });
    const port = nativeExecutionPort(path.join(root, 'executions'));
    const signal = new AbortController().signal;
    try {
      const plan = await port.preflight(
        {
          sessionId: crypto.randomUUID(),
          runId: crypto.randomUUID(),
          executionId: crypto.randomUUID(),
          implementation,
          profile: {
            id: 'journey-contract',
            name: 'Journey contract',
            adapter: 'python-unittest-v1',
            pythonCommand: 'python',
            frameworkSource: framework,
            instructions: '',
            targetUrl: `http://127.0.0.1:${address.port}`,
            timeoutSeconds: 60,
          },
        },
        signal,
      );
      expect(plan.scriptSha256).toBe(source.scriptSha256);
      expect(plan.frameworkSha256).toBe(source.frameworkSha256);
      const evidence = await port.execute(plan, plan.digest, signal);
      expect(evidence.results.filter((item) => ['error', 'skipped'].includes(item.status))).toEqual([]);
      expect(evidence.results.filter((item) => item.status === 'failed').length).toBe(defect ? 1 : 0);
      expect(evidence.requests.length).toBeGreaterThan(0);
      writeFileSync(path.join(root, 'evidence.json'), JSON.stringify(evidence, null, 2));
      results.push({
        target: defect ?? 'reference',
        scriptSha256: plan.scriptSha256,
        frameworkSha256: plan.frameworkSha256,
        evidenceDigest: evidence.resultSha256,
        results: evidence.results.map(({ testName, status }) => ({ testName, status })),
      });
    } finally {
      target.closeAllConnections();
      await new Promise<void>((resolve) => target.close(() => resolve()));
    }
  }
  writeFileSync(path.resolve('.runtime/journey-contract/results.json'), JSON.stringify(results, null, 2));
});
