import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { parseArgs } from 'node:util';
import Ajv2020 from 'ajv/dist/2020.js';
import { runProcess } from './blackbox/process.mjs';
import { createGameTarget } from '../tests/fixtures/blackbox/game-target.mjs';

const { values } = parseArgs({
  options: { model: { type: 'string' }, 'reuse-script': { type: 'boolean', default: false } },
});
const root = path.resolve('.runtime/game-agent');
mkdirSync(root, { recursive: true });
const workspace = path.join(root, 'workspace');
mkdirSync(workspace, { recursive: true });
const artifactPath = path.join(root, 'agent-artifact.json');
if (values['reuse-script'] && !existsSync(artifactPath)) {
  const archivedRoot = 'docs/examples/generated/game-platform';
  const archived = JSON.parse(readFileSync(`${archivedRoot}/report.json`, 'utf8'));
  const script = readFileSync(`${archivedRoot}/test_game_platform.py`, 'utf8');
  if (createHash('sha256').update(script).digest('hex') !== archived.scriptSha256)
    throw new Error('archived_script_digest_mismatch');
  writeFileSync(
    artifactPath,
    JSON.stringify({ script, coverage: archived.coverage, questions: archived.questions }),
  );
  writeFileSync(
    path.join(root, 'generation.json'),
    JSON.stringify({ model: archived.model, at: archived.generatedAt }),
  );
}
const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['script', 'coverage', 'questions'],
  properties: {
    script: { type: 'string', minLength: 100, maxLength: 100000 },
    coverage: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['requirementId', 'method', 'testNames'],
        properties: {
          requirementId: { type: 'string' },
          method: { type: 'string' },
          testNames: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', pattern: '^test_[a-zA-Z0-9_]+$' },
          },
        },
      },
    },
    questions: { type: 'array', items: { type: 'string' }, maxItems: 50 },
  },
};
const validate = new Ajv2020({ strict: false }).compile(schema);
if (!values['reuse-script']) {
  if (!values.model)
    throw new Error(
      'Pass --model with a locally configured Codex model. This makes one real inference call.',
    );
  const prompt = JSON.stringify({
    instruction:
      'Generate Python black-box tests using ONLY topic and provided framework. You have no system source and may not use any tools. Return ONLY a JSON object matching outputSchema, with no markdown. Write 25-40 independent unittest test methods in one class inheriting BlackBoxCase. Import only unittest and from framework import BlackBoxCase. Do not redefine setUp or use files, shell, raw networking, sleep or source inspection. Use client.call and client.parallel as documented. Cover normal/invalid equivalence, number versus string/null/fraction types, both range boundaries, ranked decision combinations, room access, stale actions, finished state, idempotent scoring, concurrent room capacity and external matchmaker refusal. Only assert behavior specified by the topic. Do not invent status codes for unspecified cases; list questions instead. Each test is reset by the framework. Do not add a main entry point. Use meaningful test_names and map every test name to its requirement and design method in coverage. Fractional means a nonintegral number such as 2.5; 2.0 is numerically an integer.',
    topic: readFileSync('docs/examples/game-platform-blackbox-topic.md', 'utf8'),
    framework: readFileSync('tests/fixtures/blackbox/framework.py', 'utf8'),
    outputSchema: schema,
  });
  const request = {
    turnId: randomUUID(),
    sessionId: randomUUID(),
    driver: 'codex',
    model: values.model,
    prompt,
    timeoutSeconds: 300,
  };
  const binary = path.resolve(`target/debug/examples/turn${process.platform === 'win32' ? '.exe' : ''}`);
  if (!existsSync(binary))
    throw new Error('Build the CLI bridge first: cargo build -p agent-runtime --example turn --locked');
  console.log('Generating Python tests through the real local Codex CLI (one bounded call).');
  const result = await runProcess(binary, [workspace], JSON.stringify(request), { timeout: 320000 });
  const record = result.stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line))
    .find((item) => item.outcome)?.outcome;
  writeFileSync(
    path.join(root, 'cli-outcome.json'),
    JSON.stringify(record ?? { error: 'invalid_protocol' }, null, 2),
  );
  if (!record || record.status !== 'completed')
    throw new Error(`agent_failed: ${record?.errorCode ?? 'invalid_protocol'}`);
  const artifact = JSON.parse(record.text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1'));
  if (!validate(artifact)) throw new Error('agent_artifact_invalid');
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  writeFileSync(
    path.join(root, 'generation.json'),
    JSON.stringify({ model: values.model, at: new Date().toISOString() }, null, 2),
  );
}
const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
if (!validate(artifact)) throw new Error('agent_artifact_invalid');
const script = path.join(root, 'test_game_platform.py');
writeFileSync(script, artifact.script);
copyFileSync('tests/fixtures/blackbox/framework.py', path.join(root, 'framework.py'));
async function execute(fixed) {
  const name = fixed ? 'reference' : 'buggy';
  const target = createGameTarget(fixed);
  await new Promise((resolve) => target.listen(0, '127.0.0.1', resolve));
  const evidenceFile = path.join(root, `${name}-evidence.jsonl`);
  writeFileSync(evidenceFile, '');
  const summaryFile = path.join(root, `${name}-result.json`);
  const env = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    WINDIR: process.env.WINDIR,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    PYTHONIOENCODING: 'utf-8',
    BLACKBOX_BASE_URL: `http://127.0.0.1:${target.address().port}`,
    BLACKBOX_EVIDENCE_FILE: evidenceFile,
  };
  try {
    const result = await runProcess(
      'python',
      ['-I', path.resolve('scripts/blackbox/run-python.py'), script, summaryFile],
      '',
      { timeout: 45000, env },
    );
    writeFileSync(path.join(root, `${name}-unittest.log`), result.stderr);
    return JSON.parse(readFileSync(summaryFile, 'utf8'));
  } finally {
    target.closeAllConnections();
    await new Promise((resolve) => target.close(resolve));
  }
}
console.log('Validating and executing generated tests against the controlled buggy and reference targets.');
const buggy = await execute(false);
const reference = await execute(true);
const clusters = new Map();
for (const failure of buggy.failures) {
  const name = failure.test.match(/(?:^|\.)(test_[A-Za-z0-9_]+)(?:\s|$)/)?.[1] ?? failure.test;
  const mapping = artifact.coverage.find((item) => item.testNames.includes(name));
  const key = `${mapping?.requirementId ?? name}:${mapping?.method ?? 'unmapped'}`;
  const cluster = clusters.get(key) ?? {
    requirementId: mapping?.requirementId,
    method: mapping?.method,
    tests: [],
  };
  cluster.tests.push(failure.test);
  clusters.set(key, cluster);
}
const verified =
  buggy.total >= 10 &&
  buggy.failures.length > 0 &&
  !buggy.errors.length &&
  !buggy.skipped &&
  reference.total === buggy.total &&
  !reference.failures.length &&
  !reference.errors.length &&
  !reference.skipped;
const report = {
  scope: 'real_codex_generated_python_controlled_fixture',
  verified,
  model: JSON.parse(readFileSync(path.join(root, 'generation.json'), 'utf8')).model,
  generatedAt: JSON.parse(readFileSync(path.join(root, 'generation.json'), 'utf8')).at,
  verifiedAt: new Date().toISOString(),
  buggy,
  reference,
  candidateGroups: [...clusters.values()],
  coverage: artifact.coverage,
  questions: artifact.questions,
};
writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(
  path.join(root, 'report.md'),
  `# 游戏对战平台：真实 CLI 生成 Python 黑盒验证\n\n时间：${report.generatedAt}。一次真实 Codex 调用根据题目与框架生成 Python，未提供被测实现源码。测试在受控本地样例执行；不代表内部 CodeAgent 已实测。\n\n- 生成并执行 ${buggy.total} 项测试。\n- 缺陷样例：${buggy.failures.length} 项断言失败、${buggy.errors.length} 项执行错误，按需求／方法暂分 ${clusters.size} 组候选问题。\n- 参考实现：${reference.failures.length} 项失败、${reference.errors.length} 项执行错误。\n- 本轮验证：${verified ? '通过' : '待修正'}。问题分组不是根因去重或完备性证明。\n\n生成脚本：test_game_platform.py；复现证据：buggy-evidence.jsonl；详细结果：report.json；每次生成只调用模型一次，无自动付费重试。\n\n${[...clusters.values()].map((item) => `- ${item.requirementId} / ${item.method}: ${item.tests.map((name) => name.split('.').at(-1)).join(', ')}`).join('\n')}\n`,
);
console.log(
  JSON.stringify(
    {
      verified,
      tests: buggy.total,
      failures: buggy.failures.length,
      errors: buggy.errors.length,
      candidateGroups: clusters.size,
      referenceFailures: reference.failures.length,
      referenceErrors: reference.errors.length,
      report: '.runtime/game-agent/report.md',
    },
    null,
    2,
  ),
);
if (!verified) process.exitCode = 1;
