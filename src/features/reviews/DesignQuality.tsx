import { designQuality } from '../../domain/runtime/design-quality';
import type { WorkflowRun } from '../../domain/runtime/types';
import { useI18n } from '../../shared/i18n/context';
import type { AssetView } from './AssetsWorkspace';

export function DesignQuality({
  run,
  navigate,
}: {
  run: WorkflowRun;
  navigate: (view: AssetView, id: string) => void;
}) {
  const { t, locale } = useI18n();
  const quality = designQuality(run);
  const number = new Intl.NumberFormat(locale);
  const labels = {
    level: 'qualityLevel',
    scenario: 'qualityScenario',
    question: 'qualityQuestion',
    gap: 'qualityGap',
  } as const;
  return (
    <details className="design-quality" open={quality.findings.length > 0}>
      <summary>
        {t('qualityTitle')} · {number.format(quality.findings.length)}
      </summary>
      <p className="wb-muted">{t('qualityHint')}</p>
      <div className="design-quality-summary">
        <span>
          {t('qualityLevels')} · {number.format(quality.coveredLevels)} / {number.format(quality.levels)}
        </span>
        <span>
          {t('qualityScenarios')} · {number.format(quality.coveredScenarios)} /{' '}
          {number.format(quality.scenarios)}
        </span>
      </div>
      {!quality.casesGenerated && <p className="wb-muted">{t('qualityPendingCases')}</p>}
      {quality.findings.length ? (
        <ul className="design-quality-findings">
          {quality.findings.map((item, index) => (
            <li key={`${item.kind}:${item.id}:${index}`}>
              <span className="wb-muted">{t(labels[item.kind])}</span>
              {item.id ? (
                <button className="workbench-btn wb-text" onClick={() => navigate(item.target, item.id)}>
                  {item.id} · {item.text}
                </button>
              ) : (
                <span>{item.text}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t('qualityNone')}</p>
      )}
    </details>
  );
}
