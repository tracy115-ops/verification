import { writeFileSync, mkdirSync } from 'node:fs';
import { createTarget } from '../tests/fixtures/blackbox/target.mjs';
import { runPlan } from './blackbox/runner.mjs';
import { baseline, enhanced } from './blackbox/plan.mjs';

async function sample(fixed, plan) {
  const target = createTarget(fixed);
  await new Promise((resolve) => target.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${target.address().port}`;
  try {
    return await runPlan(base, plan);
  } finally {
    target.closeAllConnections();
    await new Promise((resolve) => target.close(resolve));
  }
}
const normal = await sample(false, baseline);
const faulty = await sample(false, enhanced);
const reference = await sample(true, enhanced);
const ok =
  normal.counts.failed === 0 &&
  faulty.counts.bugs === 9 &&
  faulty.counts.inconclusive === 0 &&
  reference.counts.failed === 0 &&
  reference.counts.inconclusive === 0;
const report = {
  benchmark: 'blackbox-account-v1',
  scope: 'controlled_seeded_fixture_not_real_project',
  verified: ok,
  baseline: normal,
  enhanced: faulty,
  reference,
};
mkdirSync('.runtime/blackbox', { recursive: true });
writeFileSync('.runtime/blackbox/report.json', JSON.stringify(report, null, 2));
const rows = faulty.cases
  .filter((item) => item.status === 'failed')
  .map((item) => `| ${item.id} | ${item.title} | ${item.requirementId} | ${item.category} |`)
  .join('\n');
const markdown = `# 本地黑盒缺陷发现基准\n\n时间：${new Date().toISOString()}。本报告是实际 HTTP 请求结果，目标为受控种子缺陷样例，不是用户真实系统，也不是 Agent 自主生成测试的认证。\n\n- 正常路径：${normal.counts.total} 项，发现 ${normal.counts.bugs} 类候选缺陷。\n- 增强计划：${faulty.counts.total} 项，${faulty.counts.failed} 项失败，合并为 ${faulty.counts.bugs} 类候选缺陷；${faulty.counts.inconclusive} 项无法判定。\n- 修正参考实现：${reference.counts.total} 项，${reference.counts.failed} 项失败，${reference.counts.inconclusive} 项无法判定。\n- 基准验收：${ok ? '通过' : '失败'}。详细请求、响应、断言差异见 report.json。\n\n| 用例 | 问题 | 规则 | 方法 |\n| --- | --- | --- | --- |\n${rows}\n\n复现命令：在仓库根目录执行 npm run verify:blackbox。每次启动全新本地目标，执行器仅使用公开题目与 HTTP 接口。\n`;
writeFileSync('.runtime/blackbox/report.md', markdown);
console.log(
  JSON.stringify(
    {
      verified: ok,
      baseline: normal.counts,
      enhanced: faulty.counts,
      reference: reference.counts,
      report: '.runtime/blackbox/report.md',
    },
    null,
    2,
  ),
);
if (!ok) process.exitCode = 1;
