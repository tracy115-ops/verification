import type { WorkflowRun } from '../../domain/runtime/types';
import { useI18n } from '../../shared/i18n/context';
import { ArtifactPanel } from '../sessions/ArtifactPanel';
import { CaseReview } from './CaseReview';
import { ReviewWorkspace } from './ReviewWorkspace';

export function AssetsWorkspace({
  cases,
  setCases,
  run,
}: {
  cases: boolean;
  setCases: (value: boolean) => void;
  run?: WorkflowRun;
}) {
  const { t } = useI18n();
  const types = cases
    ? ['TestCaseSet', 'TestCaseSetDraft']
    : ['RequirementBaseline', 'TestDesign', 'RequirementBaselineDraft', 'TestDesignDraft'];
  const artifacts = run ? Object.values(run.artifacts).filter((item) => types.includes(item.type)) : [];
  return (
    <div className="assets-workspace">
      <nav className="assets-tabs" aria-label={t('assetsTitle')}>
        <button className="workbench-btn" aria-pressed={!cases} onClick={() => setCases(false)}>
          {t('requirementsTab')}
        </button>
        <button className="workbench-btn" aria-pressed={cases} onClick={() => setCases(true)}>
          {t('caseTab')}
        </button>
      </nav>
      {run ? (
        <div className="assets-run-content">
          <p className="wb-banner">
            {run.snapshot.definition.name} · r{run.snapshot.revision} · {t('testsNotExecuted')}
          </p>
          {artifacts.map((artifact, index) => (
            <ArtifactPanel key={index} artifact={artifact} />
          ))}
        </div>
      ) : cases ? (
        <CaseReview />
      ) : (
        <ReviewWorkspace />
      )}
    </div>
  );
}
