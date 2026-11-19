import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createQuotaTarget, quotaObservationDefect } from '../tests/fixtures/blackbox/quota-target.mjs';
import { runProcess } from './blackbox/process.mjs';

const archived = 'docs/examples/generated';
const original = `${archived}/quota-workflow-2026-11-18`;
const followup = `${archived}/case-scenario-review-2026-11-19`;
const read = (file) => readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const workspace = path.resolve('.runtime/quota-observation-native');
const executable = path.resolve(`target/debug/examples/local${process.platform === 'win32' ? '.exe' : ''}`);
const frameworkSource = read('tests/fixtures/blackbox/framework.py');
const originalBundle = {
  script: read(`${original}/test_quota.py`),
  tests: json(`${original}/case-methods.json`),
  questions: [],
};
const updatedBundle = json(`${followup}/case-observation-implementation.json`);
const oldCase = 'B2-C06_released_hold_replay';
const newCase = 'C_S06_01';

async function execute(implementation, defect) {
  const target = createQuotaTarget(defect);
  await new Promise((resolve, reject) => {
    target.once('error', reject);
    target.listen(0, '127.0.0.1', resolve);
  });
  try {
    const payload = {
      sessionId: randomUUID(),
      runId: randomUUID(),
      executionId: randomUUID(),
      implementation,
      profile: {
        id: 'quota-observation',
        name: 'Quota observation fixture',
        adapter: 'python-unittest-v1',
        pythonCommand: 'python',
        frameworkSource,
        instructions: '',
        targetUrl: `http://127.0.0.1:${target.address().port}`,
        timeoutSeconds: 60,
      },
    };
    async function request(operation, approvedDigest = null) {
      const input = JSON.stringify({ operation, payload, approvedDigest });
      const result = await runProcess(executable, [workspace], input, { timeout: 75000 });
      const response = JSON.parse(result.stdout);
      if (!('Ok' in response)) throw new Error(String(response.Err));
      return response.Ok;
    }
    const plan = await request('preflight');
    const evidence = await request('execute', plan.digest);
    return { plan, evidence };
  } finally {
    target.closeAllConnections();
    await new Promise((resolve) => target.close(resolve));
  }
}

function verifyObservation(evidence, testName, defect) {
  const requests = evidence.requests.filter((entry) => entry.test?.split('.').at(-1) === testName);
  const rejection = requests.findIndex(
    (entry) => entry.request.method === 'POST' && entry.request.path.endsWith('/consume'),
  );
  assert.ok(rejection >= 0);
  assert.equal(requests[rejection].response.status, 409);
  const holdPath = requests[rejection].request.path.slice(0, -'/consume'.length);
  const responsePair = (route) => {
    const matches = (entry) => entry.request.method === 'GET' && entry.request.path === route;
    return [
      requests.slice(0, rejection).findLast(matches)?.response,
      requests.slice(rejection + 1).find(matches)?.response,
    ];
  };
  const [before, after] = responsePair(holdPath);
  assert.ok(before && after);
  assert.equal(before.status, 200);
  assert.equal(before.body.state, 'released');
  assert.deepEqual(
    after,
    defect ? { ...before, body: { ...before.body, key: 'ChangedAfterReject' } } : before,
  );
  const [quotaBefore, quotaAfter] = responsePair('/quota');
  assert.deepEqual(quotaBefore, { status: 200, body: { available: 4, consumed: 0 } });
  assert.deepEqual(quotaAfter, quotaBefore);
  return { rejectedStatus: 409, before, after, quotaBefore, quotaAfter };
}

mkdirSync(workspace, { recursive: true });
const comparisons = [];
for (const [suite, bundle, caseId] of [
  ['original', originalBundle, oldCase],
  ['followup', updatedBundle, newCase],
]) {
  for (const defect of [null, quotaObservationDefect]) {
    const variant = defect ?? 'reference';
    const expected = suite === 'followup' && defect ? 'failed' : 'passed';
    const { plan, evidence } = await execute(bundle, defect);
    const methods = bundle.tests.filter((entry) => entry.caseIds.includes(caseId));
    assert.equal(methods.length, 1);
    const { testName } = methods[0];
    const result = evidence.results.find((entry) => entry.testName === testName);
    assert.equal(result?.status, expected);
    assert.equal(evidence.results.length, bundle.tests.length);
    assert.ok(evidence.results.every((entry) => entry.status === (entry === result ? expected : 'passed')));
    const observation = suite === 'followup' ? verifyObservation(evidence, testName, defect) : undefined;
    const assertion =
      expected === 'failed'
        ? result.details
            .flatMap((detail) => detail.split('\n'))
            .find((line) => line.startsWith('AssertionError:'))
        : undefined;
    if (expected === 'failed') assert.match(assertion ?? '', /ChangedAfterReject/);
    comparisons.push({
      suite,
      variant,
      caseId,
      testName,
      status: result.status,
      total: evidence.results.length,
      scriptSha256: plan.scriptSha256,
      frameworkSha256: plan.frameworkSha256,
      rawEvidenceSha256: evidence.rawEvidenceSha256,
      observation,
      assertion,
    });
  }
}
const summary = JSON.stringify(comparisons, null, 2);
writeFileSync(path.join(workspace, 'comparison.json'), `${summary}\n`);
console.log(summary);
