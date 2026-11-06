import { expect, it } from 'vitest';
import { reportRunFixture } from '../../../tests/fixtures/report-run';
import { candidateTrace, requestsForTest } from './candidate-trace';
import type { EvidenceBundle, VerificationReport } from '../execution/types';

function setup() {
  const run = reportRunFixture();
  const report = Object.values(run.artifacts).find((item) => item.type === 'VerificationReport')!
    .value as VerificationReport;
  return { run, report, id: report.candidates[0].id };
}
it('links the actual native failure to exactly its requests, case and original requirement', () => {
  const { run, report, id } = setup();
  const trace = candidateTrace(run, report, id)!;
  expect(Object.values(run.artifacts).find((item) => item.type === 'EvidenceBundle')!.digest).not.toBe(
    report.evidenceDigest,
  );
  expect(trace.evidence.resultSha256).toBe(report.evidenceDigest);
  expect(trace.incomplete).toBe(false);
  expect(trace.tests).toHaveLength(1);
  expect(trace.tests[0].result?.status).toBe('failed');
  expect(trace.tests[0].requests).toHaveLength(2);
  expect(trace.cases.map((item) => item.id)).toEqual(report.candidates[0].caseIds);
  expect(trace.requirements.some((item) => item.id === 'REQ-CAP-1')).toBe(true);
  expect(trace.requirements.some((item) => item.id === 'REQ-CAP-8')).toBe(false);
});
it('never substitutes stale evidence, a different execution plan or another run', () => {
  const { run, report, id } = setup();
  expect(candidateTrace(run, { ...report, evidenceDigest: 'missing' }, id)).toBeUndefined();
  const wrapperDigest = Object.values(run.artifacts).find((item) => item.type === 'EvidenceBundle')!.digest;
  expect(candidateTrace(run, { ...report, evidenceDigest: wrapperDigest }, id)).toBeUndefined();
  expect(candidateTrace({ ...run, id: crypto.randomUUID() }, report, id)).toBeUndefined();
  const evidence = Object.values(run.artifacts).find((item) => item.type === 'EvidenceBundle')!
    .value as EvidenceBundle;
  evidence.planDigest = 'different-plan';
  expect(candidateTrace(run, report, id)).toBeUndefined();
});
it('rejects unrelated method suffixes and flags missing case references instead of inventing links', () => {
  const { run, report, id } = setup();
  const evidence = Object.values(run.artifacts).find((item) => item.type === 'EvidenceBundle')!
    .value as EvidenceBundle;
  const testName = report.candidates[0].testNames[0];
  evidence.requests.push({ test: `${testName}_other`, request: { path: '/wrong' } }, null, 'invalid');
  expect(requestsForTest(evidence, testName)).toHaveLength(2);
  expect(requestsForTest(evidence, '')).toEqual([]);
  report.candidates[0].caseIds.push('MISSING');
  expect(candidateTrace(run, report, id)?.incomplete).toBe(true);
});

it('does not substitute an unapproved draft for missing approved cases', () => {
  const { run, report, id } = setup();
  for (const [key, artifact] of Object.entries(run.artifacts))
    if (artifact.type === 'TestCaseSet') delete run.artifacts[key];
  const trace = candidateTrace(run, report, id)!;
  expect(trace.cases).toEqual([]);
  expect(trace.incomplete).toBe(true);
});
