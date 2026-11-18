import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    action: { type: 'string' },
    endpoint: { type: 'string' },
    operation: { type: 'string' },
    reason: { type: 'string' },
    'expected-version': { type: 'string' },
    target: { type: 'string', default: 'http://127.0.0.1:4325' },
    model: { type: 'string', default: 'gpt-6-sol' },
  },
});
if (
  !['configure', 'start', 'status', 'review', 'approve', 'repair-quotes', 'retry', 'turns'].includes(
    values.action,
  ) ||
  !values.endpoint
)
  throw new Error('explicit_audit_action_and_endpoint_required');
if (new URL(values.target).hostname !== '127.0.0.1' || new URL(values.endpoint).hostname !== '127.0.0.1')
  throw new Error('loopback_audit_required');
const output = path.resolve('.runtime/quota-flow');
mkdirSync(output, { recursive: true });
const browser = await chromium.connectOverCDP(values.endpoint);
const page = browser.contexts()[0].pages()[0];
page.setDefaultTimeout(15000);
async function identity() {
  const id = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('plugin:app|identifier'));
  if (id !== 'dev.verification.workbench.auditquotaflow') throw new Error('isolated_app_required');
  const version = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('plugin:app|version'));
  if (values['expected-version'] && version !== values['expected-version'])
    throw new Error('unexpected_app_version');
  writeFileSync(
    path.join(output, 'current-build.json'),
    JSON.stringify({ identifier: id, version, checkedAt: new Date().toISOString() }, null, 2),
  );
}
async function configure() {
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: 'Agent 与 Provider', exact: true }).click();
  await page.getByLabel('要配置的 Agent').selectOption('codex-native');
  const model = page.locator('.settings-model-row');
  await model.getByRole('textbox').fill(values.model);
  await model.getByRole('button', { name: '保存模型', exact: true }).click();
  const check = page.getByRole('region', { name: '连通检查 · codex / native', exact: true });
  await check.getByRole('button', { name: '发送短测试', exact: true }).click();
  await check.getByText('短对话已验证', { exact: false }).waitFor({ timeout: 75000 });
  await page.getByRole('button', { name: '测试框架与执行', exact: true }).click();
  const form = page.locator('.settings-framework-form');
  await form.getByRole('textbox', { name: '框架名称', exact: true }).fill('租户配额 · 新题目端到端');
  await form.getByRole('textbox', { name: '被测接口基础地址', exact: true }).fill(values.target);
  await form.getByRole('spinbutton', { name: '测试执行超时（秒）', exact: true }).fill('90');
  await form.locator('input[type=file]').setInputFiles('tests/fixtures/blackbox/framework.py');
  await form
    .getByRole('textbox', { name: '框架调用约定与限制', exact: true })
    .fill(
      'Import BlackBoxCase from framework. Use self.client.call(method,path,body=None,user="player-a",headers=None), returning Response.status and Response.body. self.client.parallel takes up to four dictionaries with call arguments and preserves result order. Each setUp resets isolated state. The framework records request/response evidence. Do not implement helpers or setUp; tests must only use this client and unittest assertions.',
    );
  const inspection = page.getByRole('region', { name: '框架接入检查', exact: true });
  await inspection.getByRole('button', { name: '检查当前框架', exact: true }).click();
  await inspection.getByText('语法及入口声明检查完成', { exact: true }).waitFor();
  await form.getByRole('button', { name: '保存框架与目标', exact: true }).click();
  await page.getByRole('button', { name: '流程编排', exact: true }).click();
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await page.screenshot({ path: path.join(output, 'configured.png') });
}
async function start() {
  await page.getByRole('button', { name: '新建会话', exact: true }).click();
  const composer = page.locator('.session-composer');
  await composer.getByLabel('会话 Agent').selectOption('codex-native');
  await composer.getByLabel('已保存流程').selectOption('workflow');
  await composer.getByLabel('本次调用范围').selectOption('game-unittest');
  await composer.locator('input[type=file]').setInputFiles('docs/examples/quota-holds-blackbox-topic.md');
  await composer.getByRole('button', { name: '调用流程', exact: true }).click();
}
async function snapshot() {
  const run = await page.evaluate(() => {
    const sessions = JSON.parse(localStorage.getItem('verification-workbench.conversations.v1') || '[]');
    const id = localStorage.getItem('verification-workbench.active-conversation');
    return sessions.find((s) => s.id === id)?.runs.at(-1);
  });
  if (!run) return console.log(JSON.stringify({ status: 'no_run' }));
  writeFileSync(path.join(output, 'run.json'), JSON.stringify(run, null, 2));
  const names = {
    RequirementBaselineDraft: 'requirements-draft',
    RequirementBaseline: 'requirements',
    TestDesign: 'design',
    TestDesignDraft: 'design-draft',
    TestCaseSet: 'cases',
    TestCaseSetDraft: 'cases-draft',
    ImplementationBundle: 'implementation',
    EvidenceBundle: 'evidence',
    VerificationReport: 'report',
  };
  for (const item of Object.values(run.artifacts)) {
    if (names[item.type])
      writeFileSync(path.join(output, `${names[item.type]}.json`), JSON.stringify(item.value, null, 2));
  }
  console.log(
    JSON.stringify({
      status: run.status,
      error: run.errorCode,
      steps: run.plan.map((n) => ({
        operation: n.operation,
        status: run.steps[n.id].status,
        error: run.steps[n.id].errorCode,
      })),
      artifacts: Object.values(run.artifacts).map((a) => a.type),
      savedCaseBatches: run.steps.generate_cases?.caseBatches?.length ?? 0,
      progress: await page.locator('.session-cli-progress summary').allTextContents(),
    }),
  );
  return run;
}
async function review(approve) {
  if (approve && !values.reason) throw new Error('explicit_audit_review_reason_required');
  const run = await snapshot();
  const node = run?.plan.find((n) => run.steps[n.id].status === 'awaiting_review');
  if (!node || (approve && node.operation !== values.operation)) throw new Error('review_operation_mismatch');
  const dialog = page.getByRole('dialog');
  if (!(await dialog.isVisible()))
    await page
      .getByRole('complementary', { name: '流程进度' })
      .getByRole('button', { name: '打开评审工作区', exact: true })
      .click();
  await page.screenshot({ path: path.join(output, `${node.operation}.png`) });
  if (!approve) {
    console.log((await dialog.innerText()).slice(0, 16000));
    return;
  }
  if (node.operation === 'review.requirements')
    await dialog.getByLabel('首次设计分析的批次预算', { exact: true }).selectOption('4');
  if (node.operation === 'review.execution') {
    if (run.executionProfile?.targetUrl !== values.target) throw new Error('audit_target_changed');
    await dialog.locator('.session-execution-review').getByRole('checkbox').check();
  }
  const button = dialog.getByRole('button', { name: '确认并继续', exact: true });
  if (!(await button.isEnabled())) throw new Error('review_blocked_inspect_artifacts');
  await button.click();
  const file = path.join(output, 'review-decisions.json');
  const decisions = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  decisions.push({
    at: new Date().toISOString(),
    actor: 'Codex audit operator',
    operation: node.operation,
    digest: run.steps[node.id].reviewDigest,
    reason: values.reason,
  });
  writeFileSync(file, JSON.stringify(decisions, null, 2));
}
async function repairQuotes() {
  const run = await snapshot();
  if (run?.errorCode !== 'source_quote_ambiguous') throw new Error('expected_ambiguous_quote');
  // Reviewed assignments: these two generated requirements describe R4 and R5 respectively.
  const repair = page.locator('.session-quote-repair');
  for (const [id, marker] of [
    ['RELEASE_ACCESS', 'R4：'],
    ['CONSUME_ACCESS', 'R5：'],
  ]) {
    const quote = run.spec.split('\n').find((line) => line.startsWith(marker));
    if (!quote) throw new Error('source_context_missing');
    await repair.getByLabel('选择待修复需求').selectOption(id);
    await repair.getByLabel('原文引用（从 Spec 原样复制）').fill(quote);
  }
  await repair.getByRole('button', { name: '保存引用并进入需求评审', exact: true }).click();
}
async function retry() {
  const run = await snapshot();
  const failed = run?.plan.find((node) => ['failed', 'interrupted'].includes(run.steps[node.id].status));
  if (!failed || failed.operation !== values.operation) throw new Error('retry_operation_mismatch');
  await page
    .getByRole('complementary', { name: '流程进度' })
    .getByRole('button', { name: '重试当前节点', exact: true })
    .click();
}
async function turns() {
  const records = [];
  for (const turn of await page.locator('.session-cli-turn').all()) {
    const request = JSON.parse(await turn.locator('.session-cli-request pre').last().textContent());
    const text = await turn
      .locator('pre')
      .evaluateAll(
        (elements) =>
          elements.filter((element) => !element.closest('.session-cli-request')).at(-1)?.textContent ?? '',
      );
    records.push({ request, text });
  }
  writeFileSync(path.join(output, 'public-turns.json'), JSON.stringify(records, null, 2));
  console.log(
    JSON.stringify(
      records.map((turn) => ({
        operation: turn.request.operation,
        replyBytes: Buffer.byteLength(turn.text),
        feedback: turn.request.sourceQuoteFeedback,
      })),
    ),
  );
}
try {
  await identity();
  if (values.action === 'configure') await configure();
  if (values.action === 'start') await start();
  if (['review', 'approve'].includes(values.action)) await review(values.action === 'approve');
  if (values.action === 'status') await snapshot();
  if (values.action === 'repair-quotes') await repairQuotes();
  if (values.action === 'retry') await retry();
  if (values.action === 'turns') await turns();
  await page.screenshot({ path: path.join(output, 'current.png') });
} finally {
  await browser.close();
}
