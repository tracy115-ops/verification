import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createOrderTarget, orderDefects } from '../tests/fixtures/blackbox/order-target.mjs';
import { generateSample, loadSample, scriptDigest } from './blackbox/agent-sample.mjs';
import { executeSample } from './blackbox/native-sample.mjs';
import { normalOrderPaths } from './blackbox/order-baseline.mjs';

const { values } = parseArgs({
  options: {
    driver: { type: 'string', default: 'codex' },
    model: { type: 'string' },
    'reuse-script': { type: 'boolean', default: false },
  },
});
const root = path.resolve('.runtime/deep-orders');
const archive = 'docs/examples/generated/deep-orders';
mkdirSync(root, { recursive: true });
if (values['reuse-script'] && !existsSync(path.join(root, 'agent-artifact.json'))) {
  for (const file of ['agent-artifact.json', 'generation.json', 'prompt.json', 'reply.txt'])
    copyFileSync(path.join(archive, file), path.join(root, file));
}
const topic = readFileSync('docs/examples/order-journeys-blackbox-topic.md', 'utf8');
const framework = readFileSync('tests/fixtures/blackbox/framework.py', 'utf8').replace(
  'user="player-a"',
  'user="user-a"',
);
const artifact = values['reuse-script']
  ? loadSample(root)
  : await generateSample({ root, driver: values.driver, model: values.model ?? '', topic, framework });
const generation = JSON.parse(readFileSync(path.join(root, 'generation.json'), 'utf8'));
if (generation.frameworkSha256 !== scriptDigest(framework)) throw new Error('benchmark_framework_changed');
if (generation.topicSha256 !== scriptDigest(topic)) throw new Error('benchmark_topic_changed');
const baseline = [];
for (const defect of [null, ...orderDefects])
  baseline.push({ variant: defect ?? 'reference', ...(await normalOrderPaths(defect)) });
const reference = await executeSample({
  root,
  name: 'reference',
  artifact,
  framework,
  target: createOrderTarget(),
});
const variants = [];
for (const defect of orderDefects) {
  const result = await executeSample({
    root,
    name: defect,
    artifact,
    framework,
    target: createOrderTarget(defect),
  });
  const evidence = readFileSync(result.evidenceFile, 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const failureNames = new Set(result.failures.map((failure) => failure.test));
  const reproductions = result.failures.map((failure) => ({
    test: failure.test,
    trace: failure.trace,
    exchanges: evidence.filter((entry) => entry.test.split('.').at(-1) === failure.test.split('.').at(-1)),
  }));
  variants.push({
    variant: defect,
    ...result,
    detected: !!failureNames.size && !result.errors.length && !result.skipped,
    reproductions,
  });
}
const verified =
  baseline.every((item) => item.passed) &&
  reference.total >= 10 &&
  !reference.failures.length &&
  !reference.errors.length &&
  !reference.skipped &&
  variants.every(
    (item) =>
      item.detected &&
      item.total === reference.total &&
      item.reproductions.every((r) => r.exchanges.length > 1),
  );
const report = {
  benchmark: 'order-journeys-v1',
  scope: 'real_cli_generated_script_controlled_single_mutants',
  verified,
  generatedAt: generation.at,
  requestedModel: generation.requestedModel,
  driver: generation.driver,
  verifiedAt: new Date().toISOString(),
  scriptSha256: scriptDigest(artifact.script),
  baseline,
  reference,
  variants,
  coverage: artifact.coverage,
  questions: artifact.questions,
};
writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(
  path.join(root, 'report.md'),
  `# 订单深层状态旅程验证\n\n真实 ${generation.driver} 仅根据题目、框架和共用深度调查指引生成脚本；模型未获得目标源码或缺陷列表。\n\n- 测试方法：${reference.total}\n- 正常路径：${baseline.length} 个目标均通过\n- 正确参考：${reference.failures.length} 失败、${reference.errors.length} 错误\n- 独立缺陷变体：${variants.filter((item) => item.detected).length}/${variants.length} 被捕获\n- 本轮验收：${verified ? '通过' : '未通过'}\n\n${variants.map((item) => `- ${item.variant}: ${item.failures.length} 个断言失败，${item.errors.length} 个执行错误；${item.reproductions.length} 份请求/响应复现记录`).join('\n')}\n\n变体标识来自维护者已知种子，不是模型推断的根因；这不是用户系统发现率或完整覆盖认证。原始断言、每个方法的完整请求序列见 report.json。尚未自动缩减序列。\n`,
);
console.log(
  JSON.stringify(
    {
      verified,
      methods: reference.total,
      normalVariants: baseline.length,
      referenceFailures: reference.failures.length,
      referenceErrors: reference.errors.length,
      detected: variants.filter((item) => item.detected).length,
      variants: variants.map((item) => ({
        id: item.variant,
        failures: item.failures.length,
        errors: item.errors.length,
      })),
      report: path.join(root, 'report.md'),
    },
    null,
    2,
  ),
);
if (!verified) process.exitCode = 1;
