import { describe, expect, it } from 'vitest';
import { approveRun, advanceRun, retryRun } from './engine';
import { createRun } from './plan';
import { fixturePort, fixtureRun, savedDocument, spec, requirements, design } from './fixtures.test-support';
import type { WorkflowRun } from './types';
import { remainingNodeSeconds } from './deadline';

const advance = (run: WorkflowRun, port = fixturePort().port, signal = new AbortController().signal) =>
  advanceRun(
    run,
    port,
    signal,
    () => {},
    () => {},
  );
async function approve(run: WorkflowRun) {
  const node = run.plan.find((node) => run.steps[node.id].status === 'awaiting_review')!;
  return approveRun(run, node.id, run.steps[node.id].reviewDigest!);
}

describe('saved workflow execution', () => {
  it('caps a CLI attempt to the remaining workflow deadline', () => {
    const run = fixtureRun();
    run.createdAt = new Date(
      Date.now() - (run.snapshot.definition.limits.deadlineSeconds - 2) * 1000,
    ).toISOString();
    expect(remainingNodeSeconds(run, run.plan[1])).toBeLessThanOrEqual(2);
    run.createdAt = new Date(
      Date.now() - (run.snapshot.definition.limits.deadlineSeconds + 1) * 1000,
    ).toISOString();
    expect(() => remainingNodeSeconds(run, run.plan[1])).toThrow('run_deadline');
  });
  it('freezes the saved revision, profiles and inputs independently of the editor', () => {
    const doc = savedDocument();
    const run = createRun(doc, crypto.randomUUID(), spec, doc.profiles, 'codex-native');
    doc.definition.name = 'edited';
    doc.profiles[0].name = 'changed';
    expect(run.snapshot.definition.name).not.toBe('edited');
    expect(run.profiles[0].name).not.toBe('changed');
    expect(run.plan).toHaveLength(7);
    doc.revision = 0;
    expect(() => createRun(doc, crypto.randomUUID(), spec, doc.profiles, 'codex-native')).toThrow(
      'invalid_run',
    );
  });
  it('stops at all three human gates and completes only the design scope', async () => {
    const { port, requests } = fixturePort();
    let run = fixtureRun();
    for (let gate = 0; gate < 3; gate++) {
      run = await advance(run, port);
      expect(run.status).toBe('awaiting_review');
      expect(requests).toHaveLength(gate + 1);
      run = await approve(run);
    }
    run = await advance(run, port);
    expect(run.status).toBe('completed');
    expect(run.approvals).toHaveLength(3);
    expect(Object.values(run.steps).every((step) => step.status === 'succeeded')).toBe(true);
    expect(requests.map((item) => JSON.parse(item.prompt).operation)).toEqual([
      'requirements.extract',
      'scenarios.design',
      'cases.generate',
    ]);
  });
  it('rejects stale approval when the Spec changes', async () => {
    const run = await advance(fixtureRun());
    run.spec += '其他约束';
    await expect(approve(run)).rejects.toThrow('approval_stale');
  });
  it('blocks unresolved questions and coverage gaps', async () => {
    const run = await advance(fixtureRun(), fixturePort({ ...requirements, questions: ['需要澄清'] }).port);
    await expect(approve(run)).rejects.toThrow('review_unresolved');
    const ready = await approve(await advance(fixtureRun()));
    const gap = await advance(ready, fixturePort({ ...design, gaps: ['缺少异常路径'] }).port);
    await expect(approve(gap)).rejects.toThrow('review_unresolved');
  });
  it('permits manual retries beyond configured attempt limits without losing artifacts', async () => {
    const failed = await advance(fixtureRun(), fixturePort({ invalid: true }).port);
    expect(failed.status).toBe('failed');
    expect(failed.errorCode).toBe('artifact_invalid');
    const node = failed.plan.find((node) => failed.steps[node.id].status === 'failed')!;
    if (node.policy.maxAttempts > 1) expect(retryRun(failed).steps[node.id].status).toBe('pending');
    failed.steps[node.id].attempts = node.policy.maxAttempts;
    failed.steps[node.id].attempts = 100;
    const retried = retryRun(failed);
    expect(retried.steps[node.id].status).toBe('pending');
    expect(retried.steps[node.id].attempts).toBe(100);
    expect(retried.artifacts).toEqual(failed.artifacts);
    expect(retried.createdAt).toBe(failed.createdAt);
    expect(retried.resumedAt).toBeTruthy();
  });
  it('does not advance after CLI failure or cancellation', async () => {
    const port = fixturePort().port;
    port.send = async () => ({
      status: 'failed',
      text: JSON.stringify(requirements),
      errorCode: 'cli_failed',
      nativeSessionId: null,
    });
    const failed = await advance(fixtureRun(), port);
    expect(failed.status).toBe('failed');
    expect(Object.keys(failed.artifacts)).toHaveLength(1);
    const controller = new AbortController();
    controller.abort();
    expect((await advance(fixtureRun(), port, controller.signal)).status).toBe('cancelled');
  });
});
