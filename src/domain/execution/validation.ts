import { isEvidence, isExecutionPlan, isFramework, isImplementation, isVerdict } from './schema';
import type {
  FrameworkProfile,
  EvidenceBundle,
  ExecutionPlan,
  ImplementationBundle,
  VerdictAnalysis,
} from './types';
import type { CaseArtifact } from '../runtime/types';

export function decodeFramework(value: unknown): FrameworkProfile {
  if (!isFramework(value)) throw new Error('execution_invalid');
  const name = value.pythonCommand.replaceAll('\\', '/').split('/').at(-1)?.toLowerCase();
  if (
    !name ||
    !['python', 'python3', 'python.exe', 'python3.exe'].includes(name) ||
    /[\u0000-\u001f]/.test(value.pythonCommand)
  )
    throw new Error('python_invalid');
  let url: URL;
  try {
    url = new URL(value.targetUrl);
  } catch {
    throw new Error('target_invalid');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('target_invalid');
  if (new TextEncoder().encode(value.frameworkSource).length > 60000) throw new Error('execution_invalid');
  return structuredClone(value);
}
export function decodeImplementation(value: unknown, cases: CaseArtifact): ImplementationBundle {
  if (!isImplementation(value)) throw new Error('implementation_invalid');
  const ids = new Set(cases.cases.map((item) => item.id));
  const names = value.tests.map((item) => item.testName);
  const covered = new Set(value.tests.flatMap((item) => item.caseIds));
  if (
    new Set(names).size !== names.length ||
    [...covered].some((id) => !ids.has(id)) ||
    [...ids].some((id) => !covered.has(id)) ||
    new TextEncoder().encode(value.script).length > 100000
  )
    throw new Error('implementation_mapping_invalid');
  return value;
}
export function decodePlan(value: unknown): ExecutionPlan {
  if (!isExecutionPlan(value)) throw new Error('execution_invalid');
  decodeFramework(value.payload.profile);
  const names = value.payload.implementation.tests.map((item) => item.testName);
  if (value.testNames.length !== names.length || value.testNames.some((name) => !names.includes(name)))
    throw new Error('implementation_mapping_invalid');
  return value;
}
export function decodeEvidence(value: unknown, plan: ExecutionPlan): EvidenceBundle {
  if (
    !isEvidence(value) ||
    value.planDigest !== plan.digest ||
    value.executionId !== plan.payload.executionId
  )
    throw new Error('evidence_invalid');
  const names = value.results.map((item) => item.testName);
  if (
    new Set(names).size !== names.length ||
    names.length !== plan.testNames.length ||
    names.some((name) => !plan.testNames.includes(name))
  )
    throw new Error('evidence_invalid');
  return value;
}
export function decodeVerdict(
  value: unknown,
  evidence: EvidenceBundle,
  bundle: ImplementationBundle,
): VerdictAnalysis {
  if (!isVerdict(value)) throw new Error('verdict_invalid');
  const failed = new Set(
    evidence.results.filter((item) => item.status === 'failed').map((item) => item.testName),
  );
  const covered = new Set<string>();
  if (new Set(value.candidates.map((item) => item.id)).size !== value.candidates.length)
    throw new Error('verdict_invalid');
  for (const candidate of value.candidates) {
    const cases = new Set(
      bundle.tests
        .filter((item) => candidate.testNames.includes(item.testName))
        .flatMap((item) => item.caseIds),
    );
    if (
      candidate.testNames.some((name) => !failed.has(name)) ||
      candidate.caseIds.some((id) => !cases.has(id)) ||
      [...cases].some((id) => !candidate.caseIds.includes(id))
    )
      throw new Error('verdict_invalid');
    candidate.testNames.forEach((name) => covered.add(name));
  }
  if ([...failed].some((name) => !covered.has(name))) throw new Error('verdict_invalid');
  return value;
}
