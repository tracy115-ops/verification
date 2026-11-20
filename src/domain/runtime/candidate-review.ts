import Ajv2020 from 'ajv/dist/2020.js';
import { isReport } from '../execution/schema';
import { decodeVerdict } from '../execution/validation';
import { linkedExecution } from './execution-link';
import { candidateTrace } from './candidate-trace';
import { digest } from './plan';
import type { WorkflowRun } from './types';

export const candidateReviewStatuses = ['needs_evidence', 'confirmed', 'false_positive'] as const;
export type CandidateReviewStatus = (typeof candidateReviewStatuses)[number];
export interface CandidateReviewEvent {
  runId: string;
  sessionId: string;
  reportDigest: string;
  evidenceDigest: string;
  candidateId: string;
  status: CandidateReviewStatus;
  note: string;
  at: string;
}
interface CandidateReviewLog {
  version: 1;
  events: CandidateReviewEvent[];
}
export interface CandidateReviewInput {
  reportDigest: string;
  candidateId: string;
  status: CandidateReviewStatus;
  note: string;
}
export type ReviewCandidate = (run: WorkflowRun, input: CandidateReviewInput) => Promise<boolean>;
const text = { type: 'string', minLength: 1, maxLength: 4000 };
const properties = {
  runId: text,
  sessionId: text,
  reportDigest: text,
  evidenceDigest: text,
  candidateId: text,
  status: { enum: candidateReviewStatuses },
  note: text,
  at: text,
};
const validateLog = new Ajv2020({ strict: false }).compile<CandidateReviewLog>({
  type: 'object',
  additionalProperties: false,
  required: ['version', 'events'],
  properties: {
    version: { const: 1 },
    events: {
      type: 'array',
      maxItems: 200,
      items: {
        type: 'object',
        additionalProperties: false,
        required: Object.keys(properties),
        properties,
      },
    },
  },
});
export function candidateReviewEvents(run: WorkflowRun): CandidateReviewEvent[] {
  const artifact = run.artifacts['candidate.reviews'];
  if (!artifact) return [];
  if (
    artifact.type !== 'CandidateReviewLog' ||
    !validateLog(artifact.value) ||
    artifact.value.events.some(
      (event) =>
        event.runId !== run.id ||
        event.sessionId !== run.sessionId ||
        !event.note.trim() ||
        !Number.isFinite(Date.parse(event.at)),
    )
  )
    throw new Error('session_storage_invalid');
  return artifact.value.events;
}
export function candidateReviews(run: WorkflowRun, reportDigest: string, candidateId: string) {
  return candidateReviewEvents(run).filter(
    (event) => event.reportDigest === reportDigest && event.candidateId === candidateId,
  );
}
export function candidateReviewReady(run: WorkflowRun, reportDigest: string, candidateId: string) {
  const artifact = Object.values(run.artifacts).find((item) => item.type === 'VerificationReport');
  if (!artifact || artifact.digest !== reportDigest || !isReport(artifact.value)) return false;
  const report = artifact.value;
  const { plan, evidence } = linkedExecution(run);
  if (!plan || !evidence || evidence.resultSha256 !== report.evidenceDigest) return false;
  try {
    decodeVerdict(
      { candidates: report.candidates, notes: report.notes },
      evidence,
      plan.payload.implementation,
    );
    const trace = candidateTrace(run, report, candidateId);
    return !!trace && !trace.incomplete;
  } catch {
    return false;
  }
}
export async function reviewCandidate(
  initial: WorkflowRun,
  input: CandidateReviewInput,
): Promise<WorkflowRun> {
  if (
    initial.status !== 'completed' ||
    !candidateReviewStatuses.includes(input.status) ||
    !input.note.trim() ||
    input.note.trim().length > 4000
  )
    throw new Error('candidate_review_invalid');
  const artifact = Object.values(initial.artifacts).find((item) => item.type === 'VerificationReport');
  if (!artifact || !isReport(artifact.value) || artifact.digest !== input.reportDigest)
    throw new Error('approval_stale');
  const report = artifact.value;
  if (!report.candidates.some((item) => item.id === input.candidateId))
    throw new Error('candidate_review_invalid');
  if (
    input.status !== 'needs_evidence' &&
    !candidateReviewReady(initial, input.reportDigest, input.candidateId)
  )
    throw new Error('candidate_review_evidence');
  const events = candidateReviewEvents(initial);
  if (events.length >= 200) throw new Error('candidate_review_limit');
  const value: CandidateReviewLog = {
    version: 1,
    events: [
      ...events,
      {
        runId: initial.id,
        sessionId: initial.sessionId,
        reportDigest: artifact.digest,
        evidenceDigest: report.evidenceDigest,
        candidateId: input.candidateId,
        status: input.status,
        note: input.note.trim(),
        at: new Date().toISOString(),
      },
    ],
  };
  const run = structuredClone(initial);
  run.artifacts['candidate.reviews'] = { type: 'CandidateReviewLog', value, digest: await digest(value) };
  return run;
}
