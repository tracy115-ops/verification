import { isReport } from '../../domain/execution/schema';
import { useI18n } from '../../shared/i18n/context';

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
