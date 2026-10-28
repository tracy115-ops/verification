import type { EvidenceBundle, VerdictAnalysis, VerificationReport } from './types';

export function buildReport(evidence: EvidenceBundle, analysis: VerdictAnalysis): VerificationReport {
  const counts = { passed: 0, failed: 0, error: 0, skipped: 0 };
  for (const item of evidence.results) counts[item.status]++;
  const status =
    counts.error || counts.skipped ? 'inconclusive' : counts.failed ? 'candidates_found' : 'passed';
  return {
    status,
    counts,
    candidates: structuredClone(analysis.candidates),
    notes: [...analysis.notes],
    action:
      status === 'inconclusive'
        ? 'repair_test_environment'
        : status === 'candidates_found'
          ? 'review_candidates'
          : 'archive_results',
    policy: 'report_only',
    evidenceDigest: evidence.resultSha256,
  };
}
