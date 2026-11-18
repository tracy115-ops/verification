import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createQuotaTarget, quotaDefects } from '../tests/fixtures/blackbox/quota-target.mjs';
import { runProcess } from './blackbox/process.mjs';

const root = path.resolve('.runtime/quota-flow');
const run = JSON.parse(readFileSync(path.join(root, 'run.json'), 'utf8'));
const plan = Object.values(run.artifacts).find((item) => item.type === 'ExecutionPlan')?.value;
if (
  !plan ||
  run.status !== 'completed' ||
  run.spec !== readFileSync('docs/examples/quota-holds-blackbox-topic.md', 'utf8')
)
  throw new Error('completed_quota_desktop_run_required');
const implementation = plan.payload.implementation;
const framework = readFileSync('tests/fixtures/blackbox/framework.py', 'utf8');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
if (sha256(implementation.script) !== plan.scriptSha256 || sha256(framework) !== plan.frameworkSha256)
  throw new Error('approved_quota_inputs_changed');
const executable = path.resolve(`target/debug/examples/local${process.platform === 'win32' ? '.exe' : ''}`);
const workspace = path.join(root, 'replay-native');
mkdirSync(workspace, { recursive: true });

async function replay(defect) {
  const target = createQuotaTarget(defect);
  await new Promise((resolve, reject) => {
    target.once('error', reject);
    target.listen(0, '127.0.0.1', resolve);
  });
  try {
    const payload = {
      sessionId: run.sessionId,
      runId: run.id,
      executionId: randomUUID(),
      implementation,
      profile: {
        ...plan.payload.profile,
        frameworkSource: framework,
        targetUrl: `http://127.0.0.1:${target.address().port}`,
      },
    };
    async function request(operation, approvedDigest = null) {
      const result = await runProcess(
        executable,
        [workspace],
        JSON.stringify({ operation, payload, approvedDigest }),
        { timeout: 105000 },
      );
      const response = JSON.parse(result.stdout);
      if (!('Ok' in response)) throw new Error(String(response.Err));
      return response.Ok;
    }
    const prepared = await request('preflight');
    const evidence = await request('execute', prepared.digest);
    const variant = defect ?? 'reference';
    const result = {
      variant,
      statuses: evidence.results.map(({ testName, status }) => ({ testName, status })),
      requests: evidence.requests.length,
      evidenceSha256: evidence.rawEvidenceSha256,
    };
    writeFileSync(path.join(root, `replay-${variant}.json`), JSON.stringify(evidence, null, 2));
    return result;
  } finally {
    target.closeAllConnections();
    await new Promise((resolve) => target.close(resolve));
  }
}

const results = [];
for (const defect of [null, ...quotaDefects]) results.push(await replay(defect));
const summary = { scriptSha256: plan.scriptSha256, frameworkSha256: plan.frameworkSha256, results };
writeFileSync(path.join(root, 'replays.json'), JSON.stringify(summary, null, 2));
console.log(
  JSON.stringify(
    results.map(({ variant, statuses, requests }) => ({
      variant,
      requests,
      failed: statuses.filter((item) => item.status === 'failed').map((item) => item.testName),
      errors: statuses.filter((item) => !['passed', 'failed'].includes(item.status)).length,
      total: statuses.length,
    })),
  ),
);
