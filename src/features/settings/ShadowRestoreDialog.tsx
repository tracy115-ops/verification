import { useMemo } from 'react';
import type { PersonalBackup } from '../../services/personal-backup';
import type { ShadowSnapshot } from '../../services/personal-shadow';
import { summarizeBackup } from '../../services/restore-preparation';
import { isMessageKey, useI18n } from '../../shared/i18n/context';
import { ConfirmDialog } from './ConfirmDialog';

export interface ShadowRestorePreview {
  backup: PersonalBackup;
  snapshot: ShadowSnapshot;
}
export function ShadowRestoreDialog({
  preview,
  busy,
  blocked,
  stage,
  error,
  cancel,
  confirm,
}: {
  preview: ShadowRestorePreview;
  busy: boolean;
  blocked: boolean;
  stage: 'backup' | 'restore' | null;
  error: string;
  cancel: () => void;
  confirm: () => void;
}) {
  const { t, locale } = useI18n();
  const summary = useMemo(() => summarizeBackup(preview.backup), [preview.backup]);
  const count = new Intl.NumberFormat(locale);
  return (
    <ConfirmDialog title={t('shadowRestoreTitle')} busy={busy} onCancel={cancel}>
      <h3>{t('shadowRestoreTitle')}</h3>
      <p>{t('shadowRestoreScope')}</p>
      <dl className="settings-shadow-summary">
        <dt>{t('shadowCreated')}</dt>
        <dd>
          {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
            new Date(preview.snapshot.createdAt),
          )}
        </dd>
        <dt>{t('shadowRestoreSessions')}</dt>
        <dd>{count.format(summary.sessions)}</dd>
        <dt>{t('shadowRestoreRuns')}</dt>
        <dd>{count.format(summary.runs)}</dd>
        <dt>{t('shadowRestoreRecords')}</dt>
        <dd>{count.format(summary.transcripts)}</dd>
        <dt>{t('shadowRestoreFrameworks')}</dt>
        <dd>{count.format(summary.frameworks)}</dd>
        <dt>{t('shadowRestoreWorkflow')}</dt>
        <dd>{t(summary.workflow ? 'shadowRestoreIncluded' : 'shadowRestoreDefault')}</dd>
        <dt>SHA-256</dt>
        <dd>
          <code>{preview.snapshot.sha256}</code>
        </dd>
      </dl>
      <p className="wb-muted">{t('shadowRestoreSafety')}</p>
      {busy && <p role="status">{t(stage === 'restore' ? 'shadowRestoring' : 'shadowBeforeRestore')}</p>}
      {error && (
        <p role="alert" className="wb-error">
          {stage === 'backup' && (
            <>
              <strong>{t('shadowRestoreSafetyFailed')}</strong>
              <br />
            </>
          )}
          {t(isMessageKey(error) ? error : 'data_restore_failed')}
        </p>
      )}
      <div className="settings-system-actions">
        <button className="workbench-btn" disabled={busy} onClick={cancel}>
          {t('cancelAction')}
        </button>
        <button className="workbench-btn wb-primary" disabled={busy || blocked} onClick={confirm}>
          {t('shadowRestoreConfirm')}
        </button>
      </div>
    </ConfirmDialog>
  );
}
