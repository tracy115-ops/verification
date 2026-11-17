import type { FrameworkProfile } from '../../domain/execution/types';
import { frameworkInspectionState } from '../../domain/execution/framework-inspection';
import { hasDesktopBridge } from '../../services/agent-api';
import { isMessageKey, useI18n } from '../../shared/i18n/context';
import { useFrameworkInspection } from './useFrameworkInspection';

export function FrameworkInspection({
  value,
  disabled,
  openLine,
}: {
  value: FrameworkProfile;
  disabled: boolean;
  openLine: (line: number) => void;
}) {
  const { t, locale } = useI18n();
  const state = useFrameworkInspection(value, disabled);
  const report = state.record?.report;
  const status = frameworkInspectionState(report);
  const statusKey = {
    unchecked: 'frameworkInspectUnchecked',
    checked: 'frameworkInspectChecked',
    unverified: 'frameworkInspectUnknown',
    blocked: 'frameworkInspectBlocked',
  } as const;
  const errorKey =
    state.error === 'execution_timeout'
      ? 'frameworkInspectTimeout'
      : state.error === 'execution_cancelled'
        ? 'frameworkInspectCancelled'
        : isMessageKey(state.error)
          ? state.error
          : 'framework_inspection_failed';
  function lineLink(line: number | null) {
    return line ? (
      <button type="button" className="workbench-btn wb-text" onClick={() => openLine(line)}>
        {t('frameworkInspectLine').replace('{line}', new Intl.NumberFormat(locale).format(line))}
      </button>
    ) : null;
  }
  return (
    <section className="settings-framework-inspection" aria-label={t('frameworkInspectionTitle')}>
      <header>
        <h3>{t('frameworkInspectionTitle')}</h3>
        {state.busy ? (
          <button type="button" className="workbench-btn" disabled={state.stopping} onClick={state.cancel}>
            {t('frameworkInspectCancel')}
          </button>
        ) : (
          <button
            type="button"
            className="workbench-btn"
            disabled={disabled || !hasDesktopBridge() || !value.frameworkSource.trim()}
            onClick={() => void state.run()}
          >
            {t('frameworkInspect')}
          </button>
        )}
      </header>
      <p className="wb-muted">{t('frameworkInspectionHint')}</p>
      {!hasDesktopBridge() && <p className="wb-muted">{t('frameworkInspectDesktop')}</p>}
      <p aria-live="polite" className={status === 'blocked' ? 'wb-error' : undefined}>
        {t(
          state.busy
            ? state.stopping
              ? 'frameworkInspectStopping'
              : 'frameworkInspectRunning'
            : statusKey[status],
        )}
      </p>
      {state.error && (
        <p role="alert" className="wb-error">
          {t(errorKey)}
        </p>
      )}
      {report && state.record && (
        <>
          <small className="wb-muted">
            Python {report.pythonVersion} · {t('frameworkInspectTime')}{' '}
            {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(
              new Date(state.record.checkedAt),
            )}
          </small>
          <details open={status === 'blocked'}>
            <summary>{t('frameworkInspectDetails')}</summary>
            <ul className="framework-inspection-checks">
              {report.checks.map((item) => (
                <li key={item.code}>
                  <strong>
                    {t(`frameworkCheck_${item.code}`)} · {t(`frameworkStatus_${item.status}`)}
                  </strong>
                  <span>
                    {t(`frameworkReason_${item.reason}`)} {lineLink(item.line)}
                  </span>
                </li>
              ))}
            </ul>
            {report.hints.length > 0 && (
              <>
                <h4>{t('frameworkInspectHints')}</h4>
                <ul className="framework-inspection-checks">
                  {report.hints.map((hint) => (
                    <li key={hint.code}>
                      <span>
                        {t(`frameworkHint_${hint.code}`)} {lineLink(hint.line)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </details>
        </>
      )}
      <p className="wb-muted">{t('frameworkInspectBoundary')}</p>
    </section>
  );
}
