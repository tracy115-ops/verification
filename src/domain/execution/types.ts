export interface FrameworkProfile {
  id: string;
  name: string;
  adapter: 'python-unittest-v1';
  pythonCommand: string;
  frameworkSource: string;
  instructions: string;
  targetUrl: string;
  timeoutSeconds: number;
}
export interface ImplementationBundle {
  script: string;
  tests: { testName: string; caseIds: string[] }[];
  questions: string[];
}
export interface ExecutionPayload {
  sessionId: string;
  runId: string;
  executionId: string;
  profile: FrameworkProfile;
  implementation: ImplementationBundle;
}
export interface ExecutionPlan {
  digest: string;
  scriptSha256: string;
  frameworkSha256: string;
  pythonVersion: string;
  testNames: string[];
  payload: ExecutionPayload;
}
export interface EvidenceBundle {
  executionId: string;
  planDigest: string;
  results: { testName: string; status: 'passed' | 'failed' | 'error' | 'skipped'; details: string[] }[];
  requests: unknown[];
  rawEvidenceSha256: string;
  resultSha256: string;
  workspaceId: string;
}
export interface VerdictAnalysis {
  candidates: { id: string; title: string; explanation: string; testNames: string[]; caseIds: string[] }[];
  notes: string[];
}
export interface VerificationReport {
  status: 'passed' | 'candidates_found' | 'inconclusive';
  counts: { passed: number; failed: number; error: number; skipped: number };
  candidates: VerdictAnalysis['candidates'];
  notes: string[];
  action: 'archive_results' | 'review_candidates' | 'repair_test_environment';
  policy: 'report_only';
  evidenceDigest: string;
}
export interface ExecutionPort {
  preflight(payload: ExecutionPayload, signal: AbortSignal): Promise<ExecutionPlan>;
  execute(plan: ExecutionPlan, approvedDigest: string, signal: AbortSignal): Promise<EvidenceBundle>;
  cancel(executionId: string): Promise<void>;
}
