// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { reportRunFixture } from '../../tests/fixtures/report-run';
import { useConversations } from './useConversations';
import { savedDocument } from '../domain/runtime/fixtures.test-support';
import { candidateReviewEvents } from '../domain/runtime/candidate-review';
import type { VerificationReport } from '../domain/execution/types';

beforeEach(() => localStorage.clear());
afterEach(cleanup);
it('saves against the current run and rejects a stale caller without losing the saved review', async () => {
  const run = reportRunFixture();
  const artifact = Object.values(run.artifacts).find((item) => item.type === 'VerificationReport')!;
  const input = {
    reportDigest: artifact.digest,
    candidateId: (artifact.value as VerificationReport).candidates[0].id,
    status: 'confirmed' as const,
    note: 'Observed response contradicts the documented rule.',
  };
  localStorage.setItem(
    'verification-workbench.conversations.v1',
    JSON.stringify([
      {
        id: run.sessionId,
        title: 'Review',
        profileId: run.defaultProfileId,
        messages: [],
        runs: [run],
      },
    ]),
  );
  const app = renderHook(() => useConversations(savedDocument().profiles, savedDocument()));
  const current = app.result.current.session!.runs[0];
  await act(async () => {
    expect(await app.result.current.saveCandidateReview(current, input)).toBe(true);
  });
  await act(async () => {
    expect(
      await app.result.current.saveCandidateReview(current, { ...input, status: 'false_positive' }),
    ).toBe(false);
  });
  expect(candidateReviewEvents(app.result.current.session!.runs[0])).toHaveLength(1);
  expect(app.result.current.error).toBe('approval_stale');
});
