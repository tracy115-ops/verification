import { afterEach, expect, it, vi } from 'vitest';
import { runReviewActions } from './run-review-actions';
import { advanceRun } from '../domain/runtime/engine';
import { fixtureRun, fixturePort, requirements } from '../domain/runtime/fixtures.test-support';
import type { WorkflowRun } from '../domain/runtime/types';

afterEach(() => vi.restoreAllMocks());

async function setup(unresolved = false) {
  const port = fixturePort(unresolved ? { ...requirements, questions: ['Which rule?'] } : undefined).port;
  let current: WorkflowRun | undefined = await advanceRun(
    fixtureRun(),
    port,
    new AbortController().signal,
    () => {},
    () => {},
  );
  const run = current;
  const gate = run.plan.find((node) => run.steps[node.id].status === 'awaiting_review')!;
  const controller = new AbortController();
  const updateRun = vi.fn();
  const drive = vi.fn();
  const perform = vi.fn(async (task: (value: AbortController) => Promise<void>, _id: string) =>
    task(controller),
  );
  const actions = runReviewActions({
    perform,
    updateRun,
    drive,
    getRun: (sessionId, runId) =>
      current?.sessionId === sessionId && current.id === runId ? current : undefined,
  });
  return {
    run,
    gate,
    controller,
    actions,
    perform,
    updateRun,
    drive,
    setCurrent: (value?: WorkflowRun) => {
      current = value;
    },
  };
}

it('binds approval and clarification operations to the task session', async () => {
  const approved = await setup();
  await approved.actions.approve(
    approved.run,
    approved.gate.id,
    approved.run.steps[approved.gate.id].reviewDigest!,
  );
  expect(approved.perform.mock.calls[0][1]).toBe(approved.run.sessionId);
  expect(approved.drive).toHaveBeenCalledOnce();
  expect(approved.drive.mock.calls[0][0].approvals).toHaveLength(1);
  const clarified = await setup(true);
  await clarified.actions.clarify(
    clarified.run,
    clarified.gate.id,
    clarified.run.steps[clarified.gate.id].reviewDigest!,
    { 'Which rule?': 'Explicit source only.' },
  );
  expect(clarified.perform.mock.calls[0][1]).toBe(clarified.run.sessionId);
  expect(clarified.updateRun.mock.calls[0][0]).toBe(clarified.run.sessionId);
  expect(clarified.drive).not.toHaveBeenCalled();
});

it('rejects callbacks from stale or deleted review snapshots before advancing', async () => {
  const app = await setup();
  const approve = () => app.actions.approve(app.run, app.gate.id, app.run.steps[app.gate.id].reviewDigest!);
  app.setCurrent({
    ...app.run,
    clarifications: [{ question: 'New rule?', answer: 'Source only', recordedAt: new Date().toISOString() }],
  });
  await expect(approve()).rejects.toThrow('approval_stale');
  app.setCurrent();
  await expect(approve()).rejects.toThrow('approval_stale');
  expect(app.drive).not.toHaveBeenCalled();
  expect(app.updateRun).not.toHaveBeenCalled();
});

it('checks the current version again after asynchronous digest validation', async () => {
  const app = await setup();
  let release!: () => void;
  let entered!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const original = crypto.subtle.digest.bind(crypto.subtle);
  vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(async (...args) => {
    entered();
    await waiting;
    return original(...args);
  });
  const pending = app.actions.approve(app.run, app.gate.id, app.run.steps[app.gate.id].reviewDigest!);
  await started;
  const newer = { ...app.run, spec: app.run.spec + 'New version' };
  app.setCurrent(newer);
  release();
  await expect(pending).rejects.toThrow('approval_stale');
  expect(app.drive).not.toHaveBeenCalled();
  expect(app.updateRun).not.toHaveBeenCalled();
  expect(newer.approvals).toHaveLength(0);
});

it('honors cancellation during confirmation without driving the approved clone', async () => {
  const app = await setup();
  const original = crypto.subtle.digest.bind(crypto.subtle);
  vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(async (...args) => {
    app.controller.abort();
    return original(...args);
  });
  await expect(
    app.actions.approve(app.run, app.gate.id, app.run.steps[app.gate.id].reviewDigest!),
  ).rejects.toThrow('execution_cancelled');
  expect(app.drive).not.toHaveBeenCalled();
  expect(app.run.approvals).toHaveLength(0);
});
