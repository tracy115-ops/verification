import { designQuality } from '../../domain/runtime/design-quality';
import type { WorkflowRun } from '../../domain/runtime/types';
import { useI18n } from '../../shared/i18n/context';
import type { AssetView } from './AssetsWorkspace';
import { useState } from 'react';
import type { ReactNode } from 'react';

export function DesignQuality({
  run,
  navigate,
  repair,
}: {
  run: WorkflowRun;
  navigate: (view: AssetView, id: string) => void;
  repair?: ReactNode;
}) {
  const { t, locale } = useI18n();
  const quality = designQuality(run);
  const [filter, setFilter] = useState<'open' | 'pending' | 'decided'>(
    quality.open ? 'open' : quality.pending ? 'pending' : 'decided',
  );
  const findings = quality.findings.filter((item) =>
    filter === 'decided' ? ['answered', 'excluded'].includes(item.state) : item.state === filter,
  );
  const number = new Intl.NumberFormat(locale);
  const labels = {
    level: 'qualityLevel',
    scenario: 'qualityScenario',
    question: 'qualityQuestion',
    gap: 'qualityGap',
    'requirement-scenarios': 'qualityRequirementScenarios',
    'requirement-cases': 'qualityRequirementCases',
  } as const;
  return (
    <details className="design-quality" open={quality.findings.length > 0}>
      <summary>
        {t('qualityTitle')} · {t('qualityOpen')} {number.format(quality.open)}
      </summary>
      <p className="wb-muted">{t('qualityHint')}</p>
      {quality.designGenerated && (
        <div className="design-quality-summary">
          <span>
            {t('qualityLevels')} · {number.format(quality.coveredLevels)} / {number.format(quality.levels)}
          </span>
          <span>
            {t('qualityScenarios')} · {number.format(quality.coveredScenarios)} /{' '}
            {number.format(quality.scenarios)}
          </span>
        </div>
      )}
      {quality.designGenerated && !quality.casesGenerated && (
        <p className="wb-muted">{t('qualityPendingCases')}</p>
      )}
      {repair}
      <div className="design-quality-filters" role="group" aria-label={t('qualityTitle')}>
        {(['open', 'pending', 'decided'] as const).map((value) => (
          <button
            key={value}
            className="workbench-btn wb-small"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {t(value === 'open' ? 'qualityOpen' : value === 'pending' ? 'qualityPending' : 'qualityDecided')}{' '}
            · {number.format(quality[value])}
          </button>
        ))}
      </div>
      {filter === 'decided' && <p className="wb-muted">{t('qualityDecisionsHint')}</p>}
      {findings.length ? (
        <ul className="design-quality-findings">
          {findings.map((item, index) => (
            <li key={`${item.kind}:${item.id}:${index}`}>
              <span className="wb-muted">{t(labels[item.kind])}</span>
              {item.id ? (
                <button className="workbench-btn wb-text" onClick={() => navigate(item.target, item.id)}>
                  {item.id} · {item.text}
                </button>
              ) : (
                <span>{item.text}</span>
              )}
              {item.reason && (
                <p className="wb-muted">
                  {t(item.state === 'answered' ? 'qualityAnswered' : 'qualityExcluded')} · {item.reason}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          {t(
            !quality.designGenerated
              ? 'assetNotGenerated'
              : !quality.findings.length
                ? 'qualityNone'
                : 'qualityFilterEmpty',
          )}
        </p>
      )}
    </details>
  );
}
