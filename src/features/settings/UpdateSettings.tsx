import { isMessageKey, useI18n } from '../../shared/i18n/context';
import { ConfirmDialog } from './ConfirmDialog';
import { UpdateNetworkSettings } from './UpdateNetworkSettings';
import { useUpdateSettings } from './useUpdateSettings';

export function UpdateSettings({ blocked }: { blocked: boolean }) {
  const { t, locale } = useI18n();
  const {
    status,
    busy,
    error,
    backupFailed,
    cancelled,
    checked,
    confirm,
    progress,
    setConfirm,
    perform,
    cancel,
  } = useUpdateSettings(blocked);
  const number = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value / 1024 / 1024);
  return (
    <section className="settings-system-panel">
      <h2>{t('systemUpdates')}</h2>
      <p className="wb-muted">{t('updateProxy')}</p>
      <UpdateNetworkSettings disabled={!!busy} />
      <div className="settings-version-row">
        <span>{t('currentVersion')}</span>
        <strong>{status.currentVersion}</strong>
      </div>
      {!status.supported && <p className="wb-muted">{t('updateDesktopOnly')}</p>}
      <div className="settings-system-actions">
        <button
          className="workbench-btn"
          disabled={!!busy || !status.supported}
          onClick={() => void perform('check')}
        >
          {t(busy === 'check' ? 'updateChecking' : 'checkUpdates')}
        </button>
        {busy && (
          <button className="workbench-btn" onClick={cancel} disabled={busy === 'install'}>
            {t('cancelAction')}
          </button>
        )}
      </div>
      {checked && !status.release && <p role="status">{t('updateLatest')}</p>}
      {status.release && (
        <article className="settings-update-release">
          <h3>
            {t('updateAvailable')} · {status.release.version}
          </h3>
          <pre>{status.release.notes}</pre>
          <p className="wb-muted">{status.ready ? t('updateReady') : t('updateChecked')}</p>
          {busy === 'download' && (
            <div role="status">
              <p>{t('updateDownloading')}</p>
              <progress max={progress.total} value={progress.downloaded} />
              <small>
                {t('updateProgress')
                  .replace('{downloaded}', number(progress.downloaded))
                  .replace('{total}', number(progress.total))}
              </small>
            </div>
          )}
          <button
            className="workbench-btn wb-primary"
            disabled={!!busy || (status.ready && blocked)}
            onClick={() => (status.ready ? setConfirm(true) : void perform('download'))}
          >
            {t(status.ready ? 'installUpdate' : 'downloadUpdate')}
          </button>
        </article>
      )}
      {blocked && <p className="wb-muted">{t('dataBusy')}</p>}
      {cancelled && !busy && !error && <p role="status">{t('updateCancelledBeforeInstall')}</p>}
      {busy === 'backup' && !confirm && (
        <p role="status">{t(cancelled ? 'updateFinishingBackup' : 'updatePreparingBackup')}</p>
      )}
      {confirm && (
        <ConfirmDialog title={t('installUpdate')} busy={busy === 'install'} onCancel={cancel}>
          <p>{t('updateInstallConfirm')}</p>
          <p className="wb-muted">{t('updateBackupHint')}</p>
          {busy === 'backup' && <p role="status">{t('updatePreparingBackup')}</p>}
          {busy === 'install' && <p role="status">{t('updateHandingOff')}</p>}
          <div className="settings-system-actions">
            <button className="workbench-btn" disabled={busy === 'install'} onClick={cancel}>
              {t('cancelAction')}
            </button>
            <button
              className="workbench-btn wb-primary"
              disabled={blocked || !!busy}
              onClick={() => void perform('install')}
            >
              {t('installUpdate')}
            </button>
          </div>
        </ConfirmDialog>
      )}
      {error && (
        <p className="wb-error" role="alert">
          {backupFailed && (
            <>
              <strong>{t('updateBackupFailed')}</strong>
              <br />
            </>
          )}
          {isMessageKey(error) ? t(error) : t('update_network_failed')}
        </p>
      )}
    </section>
  );
}
