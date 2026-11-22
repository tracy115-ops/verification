// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { reportRunFixture } from '../../tests/fixtures/report-run';
import { useConversations } from './useConversations';
import { savedDocument } from '../domain/runtime/fixtures.test-support';
import { latestArtifact } from '../domain/runtime/bindings';
import { digest } from '../domain/runtime/plan';
import type { AgentPort } from '../domain/runtime/types';
import type {
  ExecutionPlan,
  ExecutionPort,
  EvidenceBundle,
  VerificationReport,
} from '../domain/execution/types';

beforeEach(() => localStorage.clear());
afterEach(cleanup);
it('adds an independent run, waits for approval, persists results and refuses a stale source', async () => {
  const source = reportRunFixture();
  const report = Object.values(source.artifacts).find((item) => item.type === 'VerificationReport')!;
  const originalPlan = latestArtifact(source, 'ExecutionPlan') as ExecutionPlan;
  const originalEvidence = latestArtifact(source, 'EvidenceBundle') as EvidenceBundle;
  const agent: AgentPort = {
    send: vi.fn(async () => {
      throw new Error('unexpected_cli_call');
    }),
    cancel: async () => {},
  };
  const execution: ExecutionPort = {
    preflight: vi.fn(async (payload) => ({
      ...structuredClone(originalPlan),
      payload,
      digest: await digest(payload),
    })),
    execute: vi.fn(async (plan) => ({
      ...structuredClone(originalEvidence),
      executionId: plan.payload.executionId,
      planDigest: plan.digest,
    })),
    cancel: async () => {},
  };
  localStorage.setItem(
    'verification-workbench.conversations.v1',
    JSON.stringify([
      {
        id: source.sessionId,
        title: 'Replay',
        profileId: source.defaultProfileId,
        messages: [],
        runs: [source],
      },
    ]),
  );
  const app = renderHook(() => useConversations(savedDocument().profiles, savedDocument(), agent, execution));
  const original = app.result.current.session!.runs[0];
  const candidateId = (report.value as VerificationReport).candidates[0].id;
  await act(async () => {
    expect(await app.result.current.startReproduction(original, report.digest, candidateId)).toBe(true);
  });
  expect(app.result.current.session!.runs[0]).toEqual(original);
  expect(app.result.current.session!.runs).toHaveLength(2);
  const replay = app.result.current.session!.runs[1];
  expect(app.result.current.selectedRunId).toBe(replay.id);
  expect(replay.status).toBe('awaiting_review');
  expect(execution.execute).not.toHaveBeenCalled();
  const review = replay.plan.find((node) => node.operation === 'review.execution')!;
  await act(async () => {
    await app.result.current.approve(replay, review.id, replay.steps[review.id].reviewDigest!);
  });
  expect(app.result.current.session!.runs[1].status).toBe('completed');
  expect(agent.send).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs).toHaveLength(
    2,
  );
  act(() => {
    app.result.current.updateRun(original.sessionId, { ...original, errorCode: 'newer_source' });
  });
  await act(async () => {
    expect(await app.result.current.startReproduction(original, report.digest, candidateId)).toBe(false);
  });
  expect(app.result.current.error).toBe('approval_stale');
});
