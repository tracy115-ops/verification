import type { WorkflowRun } from '../../domain/runtime/types';
import { useI18n } from '../../shared/i18n/context';
import { ArtifactPanel } from './ArtifactPanel';
import { SavedClarifications, SavedExclusions } from './ClarificationReview';

export function RunArtifacts({ run, showClarifications }: { run: WorkflowRun; showClarifications: boolean }) {
  const { t } = useI18n();
  const artifacts = Object.values(run.artifacts).filter(
    (item) =>
      !['DocumentRevision', 'RequirementBaselineDraft', 'TestDesignDraft', 'TestCaseSetDraft'].includes(
        item.type,
      ),
  );
  return (
    <div className="session-run-artifacts">
      <details>
        <summary>{t('artifactTitle')}</summary>
        {showClarifications && <SavedClarifications items={run.clarifications ?? []} />}
        <SavedExclusions items={run.reviewExclusions ?? []} />
        {artifacts.map((artifact, index) => (
          <ArtifactPanel key={index} artifact={artifact} />
        ))}
      </details>
    </div>
  );
}
