import { isReport } from '../../domain/execution/schema';
import { useI18n } from '../../shared/i18n/context';
import type { WorkflowRun } from '../../domain/runtime/types';
import { Status } from '../../shared/components/Status';

export function RunState({ run }: { run: WorkflowRun }) {
  const { t } = useI18n();
  const key =
    run.status === 'completed'
      ? run.scope === 'verification'
        ? 'workflowComplete'
        : 'designComplete'
      : run.status === 'failed'
        ? 'failedStep'
        : run.status === 'cancelled'
          ? 'cancelledRun'
          : run.status === 'interrupted'
            ? 'interruptedStep'
            : run.status === 'awaiting_review'
              ? 'reviewStep'
              : run.scope === 'verification'
                ? 'verificationScope'
                : 'designScope';
  return (
    <Status tone={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'accent'}>
      {t(key)}
    </Status>
  );
}

export function RunSummary({ value }: { value: unknown }) {
  const { t } = useI18n();
  if (!isReport(value)) return null;
  return (
    <div className="session-result-summary">
      <strong>{t(`execution_${value.status}`)}</strong>
      <div className="session-result-counts">
        {Object.entries(value.counts).map(([key, count]) => (
          <span key={key}>
            {t(`result_${key}` as 'result_passed')}: {count}
          </span>
        ))}
      </div>
      {value.candidates.length > 0 && (
        <span>
          {t('candidateDefects')}: {value.candidates.length}
        </span>
      )}
    </div>
  );
}
