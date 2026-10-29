import { useEffect, useRef, useState } from 'react';
import { version } from '../../../package.json';
import { hasDesktopBridge } from '../../services/agent-api';
import * as api from '../../services/system-api';
import { isMessageKey, useI18n } from '../../shared/i18n/context';
import { ConfirmDialog } from './ConfirmDialog';
import { UpdateNetworkSettings } from './UpdateNetworkSettings';

export function UpdateSettings({ blocked }: { blocked: boolean }) {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<api.UpdateStatus>({
    currentVersion: version,
    supported: false,
    release: null,
    ready: false,
  });
  const [busy, setBusy] = useState<'check' | 'download' | 'install' | null>(null);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState<api.UpdateProgress>({ downloaded: 0, total: 1 });
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    if (hasDesktopBridge())
      void api
        .updateStatus()
        .then((value) => {
          if (active.current) setStatus(value);
        })
        .catch(() => {});
    return () => {
      active.current = false;
      void api.cancelUpdate().catch(() => {});
    };
  }, []);
  async function perform(kind: 'check' | 'download' | 'install') {
    setError('');
    setBusy(kind);
    if (kind !== 'install') setConfirm(false);
    try {
      if (kind === 'install') {
        await api.installUpdate();
        setConfirm(false);
      } else {
        const value =
          kind === 'check'
            ? await api.checkUpdate()
            : await api.downloadUpdate((value) => {
                if (active.current) setProgress(value);
              });
        if (active.current) {
          setStatus(value);
          setChecked(true);
        }
      }
    } catch (error) {
      setConfirm(false);
      if (kind === 'install')
        void api
          .updateStatus()
          .then((value) => {
            if (active.current) setStatus(value);
          })
          .catch(() => {});
      if (active.current)
        setError(
          typeof error === 'string'
            ? error
            : error instanceof Error
              ? error.message
              : 'update_network_failed',
        );
    } finally {
      if (active.current) setBusy(null);
    }
  }
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
          <button
            className="workbench-btn"
            onClick={() => void api.cancelUpdate()}
            disabled={busy === 'install'}
          >
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
      {confirm && (
        <ConfirmDialog title={t('installUpdate')} busy={!!busy} onCancel={() => setConfirm(false)}>
          <p>{t('updateInstallConfirm')}</p>
          <div className="settings-system-actions">
            <button className="workbench-btn" onClick={() => setConfirm(false)}>
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
          {isMessageKey(error) ? t(error) : t('update_network_failed')}
        </p>
      )}
    </section>
  );
}
