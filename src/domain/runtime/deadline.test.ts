import { afterEach, expect, it, vi } from 'vitest';
import { fixtureRun } from './fixtures.test-support';
import { remainingNodeSeconds, runDeadline } from './deadline';
import { retryRun, advanceRun, approveRun } from './engine';
import { decodeConversations } from '../../services/conversation-repository';
import { verificationRun, verificationPorts } from '../execution/fixtures.test-support';

afterEach(() => vi.useRealTimers());
it('honors longer node timeouts and the remaining workflow budget', () => {
  vi.useFakeTimers();
  const run = fixtureRun();
  const node = run.plan.find((item) => item.operation === 'requirements.extract')!;
  node.policy.timeoutSeconds = 1800;
  expect(remainingNodeSeconds(run, node)).toBe(1800);
  run.snapshot.definition.limits.deadlineSeconds = 900;
  expect(remainingNodeSeconds(run, node)).toBe(900);
  vi.advanceTimersByTime(901000);
  expect(() => remainingNodeSeconds(run, node)).toThrow('run_deadline');
});

it('excludes persisted overnight waits at all four gates without replenishing active work', async () => {
  vi.useFakeTimers();
  const ports = verificationPorts();
  const controller = new AbortController();
  let run = verificationRun();
  run.snapshot.definition.limits.deadlineSeconds = 120;
  const initialDeadline = runDeadline(run);
  for (let gate = 0; gate < 4; gate++) {
    vi.advanceTimersByTime(10_000);
    run = await advanceRun(
      run,
      ports.agent,
      controller.signal,
      () => {},
      () => {},
      ports.execution,
    );
    expect(run.status).toBe('awaiting_review');
    expect(ports.calls).not.toContain('targets.execute');
    const remaining = runDeadline(run) - Date.now();
    expect(remaining).toBe(120_000 - (gate + 1) * 10_000);
    vi.advanceTimersByTime(48 * 3600_000);
    const sessions = [
      { id: run.sessionId, title: 'Review', profileId: run.defaultProfileId, messages: [], runs: [run] },
    ];
    run = decodeConversations(sessions)[0].runs[0];
    expect(runDeadline(run) - Date.now()).toBe(remaining);
    const node = run.plan.find((item) => run.steps[item.id].status === 'awaiting_review')!;
    run = await approveRun(run, node.id, run.steps[node.id].reviewDigest!);
    expect(run.reviewPausedAt).toBeUndefined();
    expect(runDeadline(run)).toBe(initialDeadline + (gate + 1) * 48 * 3600_000);
  }
  run = await advanceRun(
    run,
    ports.agent,
    controller.signal,
    () => {},
    () => {},
    ports.execution,
  );
  expect(run.status).toBe('completed');
  expect(run.approvals).toHaveLength(4);
  expect(ports.calls.filter((item) => item === 'targets.execute')).toHaveLength(1);
});

it('does not hide active execution timeout behind human review pauses', async () => {
  vi.useFakeTimers();
  const ports = verificationPorts();
  let run = await advanceRun(
    verificationRun(),
    ports.agent,
    new AbortController().signal,
    () => {},
    () => {},
    ports.execution,
  );
  vi.advanceTimersByTime(7 * 24 * 3600_000);
  const node = run.plan.find((item) => run.steps[item.id].status === 'awaiting_review')!;
  const approved = await approveRun(run, node.id, run.steps[node.id].reviewDigest!);
  vi.advanceTimersByTime((run.snapshot.definition.limits.deadlineSeconds + 1) * 1000);
  run = await advanceRun(
    approved,
    ports.agent,
    new AbortController().signal,
    () => {},
    () => {},
    ports.execution,
  );
  expect(run.errorCode).toBe('run_deadline');
  expect(ports.calls).not.toContain('scenarios.design');
});

it('recovers legacy review records once while retaining digest validation', async () => {
  vi.useFakeTimers();
  const ports = verificationPorts();
  const run = await advanceRun(
    verificationRun(),
    ports.agent,
    new AbortController().signal,
    () => {},
    () => {},
    ports.execution,
  );
  delete run.reviewPausedAt;
  const node = run.plan.find((item) => run.steps[item.id].status === 'awaiting_review')!;
  vi.advanceTimersByTime(30 * 24 * 3600_000);
  await expect(
    approveRun({ ...run, spec: run.spec + 'Changed' }, node.id, run.steps[node.id].reviewDigest!),
  ).rejects.toThrow('approval_stale');
  const approved = await approveRun(run, node.id, run.steps[node.id].reviewDigest!);
  expect(runDeadline(approved) - Date.now()).toBe(run.snapshot.definition.limits.deadlineSeconds * 1000);
  vi.advanceTimersByTime(1000);
  expect(runDeadline(approved) - Date.now()).toBe(
    run.snapshot.definition.limits.deadlineSeconds * 1000 - 1000,
  );
});

it('rejects invalid review clocks at the persistence boundary', () => {
  const run = fixtureRun();
  const decode = () =>
    decodeConversations([
      { id: run.sessionId, title: '', profileId: run.defaultProfileId, messages: [], runs: [run] },
    ]);
  run.reviewPausedAt = 'invalid';
  expect(decode).toThrow('session_storage_invalid');
  run.reviewPausedAt = run.createdAt;
  expect(decode).toThrow('session_storage_invalid');
  run.status = 'awaiting_review';
  run.reviewWaitMs = -1;
  expect(decode).toThrow('session_storage_invalid');
  run.reviewWaitMs = 1.5;
  expect(decode).toThrow('session_storage_invalid');
});

it('renews a cancelled review without retaining its old wait allowance', async () => {
  vi.useFakeTimers();
  const ports = verificationPorts();
  const run = await advanceRun(
    verificationRun(),
    ports.agent,
    new AbortController().signal,
    () => {},
    () => {},
    ports.execution,
  );
  run.status = 'cancelled';
  run.reviewWaitMs = 3600_000;
  vi.advanceTimersByTime(48 * 3600_000);
  const retried = retryRun(run);
  expect(retried.id).toBe(run.id);
  expect(retried.reviewPausedAt).toBeUndefined();
  expect(retried.reviewWaitMs).toBeUndefined();
  expect(runDeadline(retried) - Date.now()).toBe(run.snapshot.definition.limits.deadlineSeconds * 1000);
  expect(retried.artifacts).toEqual(run.artifacts);
});

it('renews an expired run on manual retry and persists the resume time', () => {
  vi.useFakeTimers();
  const run = fixtureRun();
  run.status = 'failed';
  run.errorCode = 'run_deadline';
  vi.advanceTimersByTime((run.snapshot.definition.limits.deadlineSeconds + 1) * 1000);
  const retried = retryRun(run);
  expect(retried.id).toBe(run.id);
  expect(remainingNodeSeconds(retried, retried.plan[0])).toBe(retried.plan[0].policy.timeoutSeconds);
  const sessions = [
    { id: run.sessionId, title: 'retry', profileId: 'codex-native', messages: [], runs: [retried] },
  ];
  expect(decodeConversations(sessions)[0].runs[0].resumedAt).toBe(retried.resumedAt);
  expect(() =>
    decodeConversations([{ ...sessions[0], runs: [{ ...retried, resumedAt: 'bad-date' }] }]),
  ).toThrow('session_storage_invalid');
});
