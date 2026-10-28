import type { Artifact } from '../../domain/runtime/types';
import { isCases, isDesign, isRequirements } from '../../domain/runtime/artifacts';
import { isEvidence, isImplementation, isReport } from '../../domain/execution/schema';
import type { MessageKey } from '../../shared/i18n/messages';

export function artifactLabel(artifact: Artifact, t: (key: MessageKey) => string, locale: string) {
  const number = (count: number) => new Intl.NumberFormat(locale).format(count);
  const value = artifact.value;
  if (isRequirements(value))
    return t('artifactRequirementsCount').replace('{count}', number(value.requirements.length));
  if (isDesign(value))
    return t('artifactDesignCount')
      .replace('{factors}', number(value.factors?.length ?? 0))
      .replace('{scenarios}', number(value.scenarios.length));
  if (isCases(value)) return t('artifactCasesCount').replace('{count}', number(value.cases.length));
  if (isImplementation(value)) return t('artifactTestsCount').replace('{count}', number(value.tests.length));
  if (isEvidence(value))
    return t('artifactEvidenceCount')
      .replace('{tests}', number(value.results.length))
      .replace('{requests}', number(value.requests.length));
  if (isReport(value)) return t('artifactReportCount').replace('{count}', number(value.candidates.length));
  const keys: Record<string, MessageKey> = {
    DocumentRevision: 'artifactSource',
    ExecutionPlan: 'executionReview',
    ExecutionAuthorization: 'artifactAuthorization',
    VerdictBundle: 'artifactVerdict',
    ImplementationRevision: 'artifactPreviousScript',
    ImplementationClarifications: 'scriptQuestions',
  };
  return t(keys[artifact.type] ?? 'artifactTitle');
}
