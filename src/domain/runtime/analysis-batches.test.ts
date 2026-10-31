import { describe, expect, it } from 'vitest';
import { advanceRun, approveRun, retryRun } from './engine';
import { createRun } from './plan';
import { savedDocument } from './fixtures.test-support';
import { ANALYSIS_PROMPT_LIMIT, byteLength, sourceWindows, designGroups } from './analysis-plan';
import type { AgentPort, TurnRequest, WorkflowRun, RequirementArtifact, DesignArtifact } from './types';
import { latestArtifact } from './bindings';
import { decodeRequirements, decodeDesign } from './artifacts';
import { repairRequirementQuotes } from './quote-repair';
import { decodeConversations, saveConversations } from '../../services/conversation-repository';

const largeSpec = Array.from(
  { length: 8 },
  (_, i) =>
    `## 子系统${i}\n接口${i}容量必须为2到8。\n${'这是背景说明，保留原始中文和表情😀。'.repeat(100)}\n`,
).join('');

it('allows a failed small analysis to opt into batches and persists that choice', async () => {
  const doc = savedDocument();
  const initial = createRun(
    doc,
    crypto.randomUUID(),
    '接口0容量必须为2到8。',
    doc.profiles,
    'codeagent-native',
  );
  const first = testPort(1);
  const failed = await advance(initial, first.port);
  expect(JSON.parse(first.requests[0].prompt).analysisBatch).toBeUndefined();
  const retry = retryRun(failed, true);
  const session = {
    id: retry.sessionId,
    title: 'retry',
    profileId: 'codeagent-native',
    messages: [],
    runs: [retry],
  };
  const saved = new Map<string, string>();
  saveConversations({ setItem: (key, value) => saved.set(key, value) }, [session]);
  const restored = decodeConversations(JSON.parse([...saved.values()][0]))[0].runs[0];
  const second = testPort();
  const done = await advance(retryRun(restored), second.port);
  expect(done.errorCode).toBeUndefined();
  expect(JSON.parse(second.requests[0].prompt).analysisBatch).toBeTruthy();
  expect(done.id).toBe(initial.id);
  expect(done.status).toBe('awaiting_review');
});
const advance = (run: WorkflowRun, port: AgentPort, signal = new AbortController().signal) =>
  advanceRun(
    run,
    port,
    signal,
    () => {},
    () => {},
  );
function runForSpec() {
  const doc = savedDocument();
  return createRun(doc, crypto.randomUUID(), largeSpec, doc.profiles, 'codeagent-native');
}
function testPort(failAt = -1, invalidQuoteAt = -1) {
  const requests: TurnRequest[] = [];
  const port: AgentPort = {
    cancel: async () => {},
    async send(request) {
      requests.push(request);
      if (requests.length === failAt)
        return { status: 'timed_out', text: '', errorCode: 'cli_timeout_after_init', nativeSessionId: null };
      const task = JSON.parse(request.prompt);
      let value: unknown;
      if (task.operation === 'requirements.extract') {
        value = {
          requirements: [...String(task.sourceSpec).matchAll(/接口(\d+)容量必须为2到8。/g)].map(
            ([quote, id]) => ({
              id: `Q${id}`,
              text: `接口${id}容量约束`,
              quote: requests.length === invalidQuoteAt ? '不存在的原文' : quote,
              acceptanceCriteria: ['容量在范围内成功，范围外拒绝'],
            }),
          ),
          questions: [],
        };
      } else {
        const requirements = (Object.values(task.inputs) as RequirementArtifact[]).find((value) =>
          Array.isArray(value.requirements),
        )!.requirements;
        value = {
          strategy: '约束与交互验证',
          factors: requirements.map((item, i) => ({
            id: `F${i}`,
            name: `容量${item.id}`,
            requirementIds: [item.id],
            levels: ['1', '2', '8', '9'],
            sourceQuote: item.quote,
          })),
          scenarios: requirements.map((item, i) => ({
            id: `S${i}`,
            title: `容量边界${item.id}`,
            requirementIds: [item.id],
            dimension: 'boundary',
            expected: '按已确认容量规则处理',
            factorLevels: [{ factorId: `F${i}`, level: '1' }],
          })),
          gaps: [],
        };
        if (task.analysisBatch?.phase === 'cross-review')
          value = { strategy: '检查组间约束，未发现已定义的交互规则', factors: [], scenarios: [], gaps: [] };
      }
      return { status: 'completed', text: JSON.stringify(value), errorCode: null, nativeSessionId: null };
    },
  };
  return { port, requests };
}

function crossPort(includeBothGroups: boolean) {
  const fixture = testPort();
  const send = fixture.port.send;
  fixture.port.send = async (...args) => {
    const result = await send(...args);
    const task = JSON.parse(args[0].prompt);
    if (task.analysisBatch?.phase !== 'cross-review') return result;
    const left = task.analysisBatch.leftRequirementIds[0];
    const right = task.analysisBatch.rightRequirementIds[0];
    const requirements = (Object.values(task.inputs) as RequirementArtifact[]).find(
      (item) => item.requirements,
    )!.requirements;
    return {
      ...result,
      text: JSON.stringify({
        strategy: '关联状态约束',
        factors: [
          {
            id: 'F',
            name: '跨组状态',
            requirementIds: [left],
            levels: ['有效'],
            sourceQuote: requirements.find((item) => item.id === left)!.quote,
          },
        ],
        scenarios: [
          {
            id: 'C',
            title: `交互${left}-${right}`,
            requirementIds: includeBothGroups ? [left, right] : [left],
            dimension: 'state',
            expected: '两组约束均成立',
            factorLevels: [{ factorId: 'F', level: '有效' }],
          },
        ],
        gaps: [],
      }),
    };
  };
  return fixture;
}

describe('bounded design analysis', () => {
  it('covers every source character, preserves Unicode and keeps exact boundary context', () => {
    const windows = sourceWindows(largeSpec);
    expect(windows.length).toBeGreaterThan(1);
    expect(windows.map((window) => largeSpec.slice(window.start, window.end)).join('')).toBe(largeSpec);
    expect(
      windows.every((window) => largeSpec.includes(window.text) && !window.text.includes('\ufffd')),
    ).toBe(true);
    expect(windows.every((window) => window.sectionPath.length <= 1)).toBe(true);
  });

  it('resumes the failed batch after serialization without re-running completed calls', async () => {
    const first = testPort(2);
    const failed = await advance(runForSpec(), first.port);
    expect(failed.status).toBe('failed');
    const node = failed.plan.find((node) => node.operation === 'requirements.extract')!;
    expect(failed.steps[node.id].analysis?.completed).toHaveLength(1);
    const session = {
      id: failed.sessionId,
      title: '分批恢复',
      profileId: 'codeagent-native',
      messages: [],
      runs: [failed],
    };
    const saved = new Map<string, string>();
    saveConversations({ setItem: (key, value) => saved.set(key, value) }, [session]);
    const restored = decodeConversations(JSON.parse([...saved.values()][0]))[0].runs[0];
    const next = testPort();
    const result = await advance(retryRun(restored), next.port);
    expect(result.status).toBe('awaiting_review');
    expect(JSON.parse(next.requests[0].prompt).analysisBatch.index).toBe(2);
    expect(
      [...first.requests, ...next.requests].every(
        (request) => byteLength(request.prompt) <= ANALYSIS_PROMPT_LIMIT,
      ),
    ).toBe(true);
    expect(
      decodeRequirements(latestArtifact(result, 'RequirementBaselineDraft'), largeSpec).requirements,
    ).toHaveLength(8);
    const stale = structuredClone(failed);
    stale.spec += '新的要求';
    const rejected = await advance(retryRun(stale), testPort().port);
    expect(rejected.errorCode).toBe('approval_stale');
    const tampered = structuredClone(failed);
    const value = tampered.steps[node.id].analysis!.completed[0].value as RequirementArtifact;
    value.requirements[0].text = '被改动的有效结构';
    expect((await advance(retryRun(tampered), testPort().port)).errorCode).toBe('artifact_invalid');
  });

  it('repairs a rejected batch without skipping the remaining source windows or human gate', async () => {
    const failed = await advance(runForSpec(), testPort(-1, 1).port);
    expect(failed.errorCode).toBe('source_quote_invalid');
    const node = failed.plan.find((node) => node.operation === 'requirements.extract')!;
    const pending = failed.steps[node.id].analysis!.rejected!;
    const edits = Object.fromEntries(
      pending.value.requirements.map((item) => [
        item.id,
        largeSpec.match(new RegExp(`接口${item.id.split('Q')[1]}容量必须为2到8。`))![0],
      ]),
    );
    const repaired = await repairRequirementQuotes(failed, edits);
    expect(repaired.steps[node.id].status).toBe('pending');
    const fixture = testPort();
    const done = await advance(repaired, fixture.port);
    expect(done.status).toBe('awaiting_review');
    expect(JSON.parse(fixture.requests[0].prompt).analysisBatch.index).toBe(2);
    expect(done.approvals).toHaveLength(0);
    expect(
      decodeRequirements(latestArtifact(done, 'RequirementBaselineDraft'), largeSpec).requirements,
    ).toHaveLength(8);
  });

  it('checks every pair of requirement groups and resumes a failed cross-group review', async () => {
    let run = await advance(runForSpec(), testPort().port);
    const review = run.plan.find((node) => run.steps[node.id].status === 'awaiting_review')!;
    run = await approveRun(run, review.id, run.steps[review.id].reviewDigest!);
    const baseline = decodeRequirements(latestArtifact(run, 'RequirementBaseline'), largeSpec);
    for (const item of baseline.requirements) item.text += '明确条件与观测结果。'.repeat(45);
    const key = Object.keys(run.artifacts).find((key) => run.artifacts[key].type === 'RequirementBaseline')!;
    run.artifacts[key].value = baseline;
    const groups = designGroups(baseline);
    const localTotal = groups.filter((group) => !group.cross).length;
    expect(localTotal).toBeGreaterThan(1);
    const failedPort = testPort(localTotal + 1);
    const failed = await advance(run, failedPort.port);
    expect(failed.errorCode).toBe('cli_timeout_after_init');
    const second = testPort();
    const done = await advance(retryRun(failed), second.port);
    expect(done.status).toBe('awaiting_review');
    const requests = [...failedPort.requests.slice(0, -1), ...second.requests];
    expect(requests).toHaveLength(groups.length);
    expect(requests.every((request) => byteLength(request.prompt) <= ANALYSIS_PROMPT_LIMIT)).toBe(true);
    expect(JSON.parse(second.requests[0].prompt).analysisBatch.phase).toBe('cross-review');
    expect(JSON.parse(second.requests[0].prompt).sourceSpec).toBeUndefined();
    expect(JSON.parse(second.requests[0].prompt).sourceTextField).toContain('requirements[].quote');
    expect(decodeDesign(latestArtifact(done, 'TestDesignDraft'), baseline).scenarios).toHaveLength(8);
    expect((await advance(retryRun(failed), crossPort(false).port)).errorCode).toBe('artifact_invalid');
    const linked = await advance(retryRun(failed), crossPort(true).port);
    expect(linked.status).toBe('awaiting_review');
    const combined = decodeDesign(latestArtifact(linked, 'TestDesignDraft'), baseline);
    expect(combined.scenarios.filter((item) => item.requirementIds.length === 2)).toHaveLength(
      groups.length - localTotal,
    );
  });

  it('rejects duplicate cached indexes and oversized requirements instead of silently dropping input', async () => {
    const failed = await advance(runForSpec(), testPort(2).port);
    const node = failed.plan.find((node) => node.operation === 'requirements.extract')!;
    failed.steps[node.id].analysis!.completed.push(failed.steps[node.id].analysis!.completed[0]);
    expect(() =>
      decodeConversations([
        {
          id: failed.sessionId,
          title: '无效缓存',
          profileId: 'codeagent-native',
          messages: [],
          runs: [failed],
        },
      ]),
    ).toThrow('session_storage_invalid');
    expect((await advance(retryRun(failed), testPort().port)).errorCode).toBe('artifact_invalid');
    expect(() =>
      designGroups({
        requirements: [{ id: 'R', text: '长'.repeat(4000), quote: '原文', acceptanceCriteria: ['规则'] }],
        questions: [],
      }),
    ).toThrow('analysis_request_too_large');
  });

  it('keeps completed batches when a later call is cancelled', async () => {
    const controller = new AbortController();
    const fixture = testPort();
    const send = fixture.port.send;
    fixture.port.send = async (...args) => {
      if (fixture.requests.length === 1) controller.abort();
      return send(...args);
    };
    const cancelled = await advance(runForSpec(), fixture.port, controller.signal);
    expect(cancelled.status).toBe('cancelled');
    const node = cancelled.plan.find((item) => item.operation === 'requirements.extract')!;
    expect(cancelled.steps[node.id].analysis?.completed).toHaveLength(1);
    const next = testPort();
    const completed = await advance(retryRun(cancelled), next.port);
    expect(completed.status).toBe('awaiting_review');
    expect(JSON.parse(next.requests[0].prompt).analysisBatch.index).toBe(2);
  });
});

it('completes the large design workflow through all human gates with batched requirements, design and cases', async () => {
  const fixture = testPort();
  const send = fixture.port.send;
  const requests: TurnRequest[] = [];
  fixture.port.send = async (...args) => {
    const request = args[0];
    requests.push(request);
    const task = JSON.parse(request.prompt);
    if (task.operation === 'cases.generate')
      return {
        status: 'completed',
        errorCode: null,
        nativeSessionId: null,
        text: JSON.stringify({
          cases: task.batch.allowedScenarioIds.map((id: string, i: number) => ({
            id: `C${i}`,
            title: `验证${id}`,
            scenarioIds: [id],
            requirementIds: task.batch.allowedRequirementIdsByScenario[id],
            preconditions: [],
            steps: ['提交边界容量请求'],
            expected: '按已确认容量约束处理',
            assertions: ['验证响应'],
          })),
        }),
      };
    const result = await send(...args);
    if (task.operation === 'requirements.extract' && result.status === 'completed') {
      const value = JSON.parse(result.text) as RequirementArtifact;
      for (const requirement of value.requirements) requirement.text += '明确条件与观测结果。'.repeat(45);
      result.text = JSON.stringify(value);
    }
    if (task.operation === 'scenarios.design' && task.analysisBatch.phase === 'design') {
      const value = JSON.parse(result.text) as DesignArtifact;
      value.scenarios = value.scenarios.flatMap((scenario) =>
        value
          .factors!.find((factor) => factor.id === scenario.factorLevels![0].factorId)!
          .levels.map((level, i) => ({
            ...scenario,
            id: `${scenario.id}L${i}`,
            title: `${scenario.title}-${level}`,
            factorLevels: [{ factorId: scenario.factorLevels![0].factorId, level }],
          })),
      );
      result.text = JSON.stringify(value);
    }
    return result;
  };
  let run = runForSpec();
  for (let gate = 0; gate < 3; gate++) {
    run = await advance(run, fixture.port);
    expect(run.status).toBe('awaiting_review');
    expect(run.approvals).toHaveLength(gate);
    const review = run.plan.find((node) => run.steps[node.id].status === 'awaiting_review')!;
    run = await approveRun(run, review.id, run.steps[review.id].reviewDigest!);
  }
  run = await advance(run, fixture.port);
  expect(run.status).toBe('completed');
  expect(run.approvals).toHaveLength(3);
  const designNode = run.plan.find((node) => node.operation === 'scenarios.design')!;
  const checkpoint = run.steps[designNode.id].analysis!;
  expect(checkpoint.localTotal).toBeGreaterThan(1);
  expect(checkpoint.completed).toHaveLength(checkpoint.total);
  const baseline = decodeRequirements(latestArtifact(run, 'RequirementBaseline'), largeSpec);
  expect(decodeDesign(latestArtifact(run, 'TestDesign'), baseline).scenarios).toHaveLength(32);
  expect(
    requests
      .filter((request) => JSON.parse(request.prompt).operation !== 'cases.generate')
      .every((request) => byteLength(request.prompt) <= ANALYSIS_PROMPT_LIMIT),
  ).toBe(true);
});
