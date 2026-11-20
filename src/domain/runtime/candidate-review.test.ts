import { expect, it } from 'vitest';
import { reportRunFixture } from '../../../tests/fixtures/report-run';
import { candidateReviewEvents, candidateReviews, reviewCandidate } from './candidate-review';
import { decodeConversations } from '../../services/conversation-repository';
import type { EvidenceBundle, VerificationReport } from '../execution/types';

function setup() {
  const run = reportRunFixture();
  const artifact = Object.values(run.artifacts).find((item) => item.type === 'VerificationReport')!;
  const report = artifact.value as VerificationReport;
  return {
    run,
    artifact,
    input: {
      reportDigest: artifact.digest,
      candidateId: report.candidates[0].id,
      status: 'confirmed' as const,
      note: 'The source requires 400; observed 201 for capacity 1.',
    },
  };
}

it('appends human decisions against original evidence without altering Agent verdict or counts', async () => {
  const { run, input } = setup();
  const original = structuredClone(run);
  const next = await reviewCandidate(run, input);
  const updated = await reviewCandidate(next, {
    ...input,
    status: 'false_positive',
    note: 'Rechecked the source.',
  });
  expect(run).toEqual(original);
  for (const [key, artifact] of Object.entries(original.artifacts))
    expect(updated.artifacts[key]).toEqual(artifact);
  expect(candidateReviews(updated, input.reportDigest, input.candidateId).map((item) => item.status)).toEqual(
    ['confirmed', 'false_positive'],
  );
  expect(candidateReviews(updated, 'another-report', input.candidateId)).toEqual([]);
  expect(candidateReviews(updated, input.reportDigest, 'another-candidate')).toEqual([]);
  const sessions = [
    {
      id: updated.sessionId,
      title: 'Review',
      profileId: updated.defaultProfileId,
      messages: [],
      runs: [updated],
    },
  ];
  expect(candidateReviewEvents(decodeConversations(sessions)[0].runs[0])).toHaveLength(2);
});

it('rejects stale reports, unknown candidates and blank reasons', async () => {
  const { run, input } = setup();
  await expect(reviewCandidate(run, { ...input, reportDigest: 'older-report' })).rejects.toThrow(
    'approval_stale',
  );
  await expect(reviewCandidate(run, { ...input, candidateId: 'unknown' })).rejects.toThrow(
    'candidate_review_invalid',
  );
  await expect(reviewCandidate(run, { ...input, note: ' ' })).rejects.toThrow('candidate_review_invalid');
  await expect(reviewCandidate({ ...run, status: 'running' }, input)).rejects.toThrow(
    'candidate_review_invalid',
  );
});

it.each(['missing', 'different-execution', 'passed-instead-of-failed'])(
  'allows requesting evidence but blocks a confirmed decision on %s evidence',
  async (variant) => {
    const { run, input } = setup();
    const entry = Object.entries(run.artifacts).find(([, item]) => item.type === 'EvidenceBundle')!;
    if (variant === 'missing') delete run.artifacts[entry[0]];
    else {
      const evidence = entry[1].value as EvidenceBundle;
      if (variant === 'different-execution') evidence.executionId = crypto.randomUUID();
      else evidence.results.find((item) => item.status === 'failed')!.status = 'passed';
    }
    await expect(reviewCandidate(run, input)).rejects.toThrow('candidate_review_evidence');
    const next = await reviewCandidate(run, {
      ...input,
      status: 'needs_evidence',
      note: 'Restore original evidence.',
    });
    expect(candidateReviewEvents(next)[0].status).toBe('needs_evidence');
  },
);

it('validates imported log ownership and rejects invalid timestamps and event limits', async () => {
  const { run, input } = setup();
  const next = await reviewCandidate(run, input);
  const value = next.artifacts['candidate.reviews'].value as {
    version: 1;
    events: Record<string, unknown>[];
  };
  const event = structuredClone(value.events[0]);
  value.events[0].runId = crypto.randomUUID();
  expect(() => candidateReviewEvents(next)).toThrow('session_storage_invalid');
  value.events[0] = { ...event, at: 'invalid' };
  expect(() => candidateReviewEvents(next)).toThrow('session_storage_invalid');
  value.events = Array.from({ length: 200 }, () => structuredClone(event));
  await expect(reviewCandidate(next, input)).rejects.toThrow('candidate_review_limit');
});
