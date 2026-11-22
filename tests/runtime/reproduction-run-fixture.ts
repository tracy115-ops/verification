import { createServer } from 'node:http';
import { reportRunFixture } from '../fixtures/report-run';
import { createGameTarget } from '../fixtures/blackbox/game-target.mjs';
import { nativeExecutionPort } from './native-execution-port';
import { latestArtifact } from '../../src/domain/runtime/bindings';
import { buildReport } from '../../src/domain/execution/report';
import { digest } from '../../src/domain/runtime/plan';
import type { ImplementationBundle, VerificationReport } from '../../src/domain/execution/types';

/** Controlled target and real baseline execution around archived reviewed design/script fixtures. */
export async function reproductionRunFixture(root: string) {
  let fixed = false;
  let delay = 0;
  const buggy = createGameTarget(false);
  const reference = createGameTarget(true);
  const target = createServer((request, response) => {
    const dispatch = () => {
      if (!response.destroyed) (fixed ? reference : buggy).emit('request', request, response);
    };
    if (delay) setTimeout(dispatch, delay);
    else dispatch();
  });
  await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
  const address = target.address();
  if (!address || typeof address === 'string') throw new Error('fixture_address');
  const source = reportRunFixture();
  const port = nativeExecutionPort(root);
  const signal = new AbortController().signal;
  const profile = { ...source.executionProfile!, targetUrl: `http://127.0.0.1:${address.port}` };
  try {
    const plan = await port.preflight(
      {
        sessionId: source.sessionId,
        runId: source.id,
        executionId: crypto.randomUUID(),
        implementation: latestArtifact(source, 'ImplementationBundle') as ImplementationBundle,
        profile,
      },
      signal,
    );
    const evidence = await port.execute(plan, plan.digest, signal);
    const oldReport = latestArtifact(source, 'VerificationReport') as VerificationReport;
    const report = buildReport(evidence, { candidates: oldReport.candidates, notes: oldReport.notes });
    const values: Record<string, unknown> = {
      ExecutionPlan: plan,
      EvidenceBundle: evidence,
      VerificationReport: report,
    };
    for (const [key, artifact] of Object.entries(source.artifacts)) {
      const value = values[artifact.type];
      if (value) source.artifacts[key] = { ...artifact, value, digest: await digest(value) };
    }
    source.executionProfile = profile;
    const reportArtifact = Object.values(source.artifacts).find(
      (item) => item.type === 'VerificationReport',
    )!;
    return {
      source,
      port,
      reportDigest: reportArtifact.digest,
      candidateId: report.candidates[0].id,
      setFixed(value: boolean) {
        fixed = value;
      },
      setDelay(value: number) {
        delay = value;
      },
      async close() {
        target.closeAllConnections();
        await new Promise<void>((resolve) => target.close(() => resolve()));
      },
    };
  } catch (error) {
    target.closeAllConnections();
    await new Promise<void>((resolve) => target.close(() => resolve()));
    throw error;
  }
}
