import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { runProcess } from './process.mjs';
import { validateSample } from './agent-sample.mjs';

function traceSummary(details) {
  return details
    .join('\n')
    .replace(/File "([^"]+)"/g, (_, filename) => `File "[validation]/${filename.split(/[\\/]/).at(-1)}"`);
}

/** Benchmark-only IDs label generated methods; these are not approved user cases. */
export async function executeSample({ root, name, artifact, framework, target }) {
  if (!validateSample(artifact) || artifact.questions.length)
    throw new Error('benchmark_unresolved_questions');
  mkdirSync(root, { recursive: true });
  await new Promise((resolve, reject) => {
    target.once('error', reject);
    target.listen(0, '127.0.0.1', resolve);
  });
  try {
    const nativeRoot = path.join(root, 'native', name);
    mkdirSync(nativeRoot, { recursive: true });
    const binary = path.resolve(`target/debug/examples/local${process.platform === 'win32' ? '.exe' : ''}`);
    const payload = {
      sessionId: randomUUID(),
      runId: randomUUID(),
      executionId: randomUUID(),
      profile: {
        id: 'deep-orders',
        name: 'Controlled order journeys',
        adapter: 'python-unittest-v1',
        pythonCommand: 'python',
        frameworkSource: framework,
        instructions: 'Trusted loopback-only benchmark framework. Each method resets state.',
        targetUrl: `http://127.0.0.1:${target.address().port}`,
        timeoutSeconds: 45,
      },
      implementation: {
        script: artifact.script,
        questions: [],
        tests: artifact.coverage.flatMap((row, i) =>
          row.testNames.map((testName, j) => ({ testName, caseIds: [`BENCH-${i + 1}-${j + 1}`] })),
        ),
      },
    };
    async function request(operation, approvedDigest) {
      const result = await runProcess(
        binary,
        [nativeRoot],
        JSON.stringify({ operation, payload, approvedDigest: approvedDigest ?? null }),
        { timeout: 60000 },
      );
      const value = JSON.parse(result.stdout);
      if (!('Ok' in value))
        throw new Error(
          `native_execution_failed:${typeof value.Err === 'string' ? value.Err : 'invalid_result'}`,
        );
      return value.Ok;
    }
    const plan = await request('preflight');
    const evidence = await request('execute', plan.digest);
    const failures = evidence.results
      .filter((row) => row.status === 'failed')
      .map((row) => ({
        test: row.testName,
        trace: traceSummary(row.details),
      }));
    const errors = evidence.results
      .filter((row) => row.status === 'error')
      .map((row) => ({
        test: row.testName,
        trace: traceSummary(row.details),
      }));
    const evidenceFile = path.join(root, `${name}.evidence.jsonl`);
    writeFileSync(evidenceFile, evidence.requests.map((item) => JSON.stringify(item)).join('\n') + '\n');
    const result = {
      total: evidence.results.length,
      tests: evidence.results.map((row) => row.testName),
      failures,
      errors,
      skipped: evidence.results.filter((row) => row.status === 'skipped').length,
      evidenceFile,
      scriptSha256: plan.scriptSha256,
      planDigest: plan.digest,
      rawEvidenceSha256: evidence.rawEvidenceSha256,
    };
    writeFileSync(path.join(root, `${name}.result.json`), JSON.stringify(result, null, 2));
    return result;
  } finally {
    target.closeAllConnections();
    await new Promise((resolve) => target.close(resolve));
  }
}
