import { useEffect, useState } from 'react';
import { hasDesktopBridge } from '../../services/agent-api';
import { readLogs, clearLogs, type LogFile } from '../../services/system-api';
import { downloadText } from '../../services/personal-backup';
import { useI18n } from '../../shared/i18n/context';
import { ConfirmDialog } from './ConfirmDialog';
export function LogSettings() {
  const { t, locale } = useI18n();
  const [files, setFiles] = useState<LogFile[]>([]);
  const [selected, setSelected] = useState('workbench.log');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState(false);
  async function refresh(clear = false) {
    setBusy(true);
    setError(false);
    try {
      if (clear) await clearLogs();
      setFiles(await readLogs());
      setConfirm(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (hasDesktopBridge()) void refresh();
  }, []);
  const file = files.find((file) => file.name === selected) ?? files[0];
  return (
    <section className="settings-system-panel">
      <h2>{t('diagnosticsLogs')}</h2>
      <p className="wb-muted">{t('logScope')}</p>
      <div className="settings-system-actions">
        <button
          className="workbench-btn"
          disabled={busy || !hasDesktopBridge()}
          onClick={() => void refresh()}
        >
          {t('refreshAction')}
        </button>
        <button
          className="workbench-btn"
          disabled={!file || busy}
          onClick={() => file && downloadText(file.name, file.text, 'text/plain')}
        >
          {t('exportLogs')}
        </button>
        <button
          className="workbench-btn"
          disabled={busy || !hasDesktopBridge()}
          onClick={() => setConfirm(true)}
        >
          {t('clearAction')}
        </button>
      </div>
      {confirm && (
        <ConfirmDialog title={t('clearAction')} busy={busy} onCancel={() => setConfirm(false)}>
          <p>{t('logsConfirm')}</p>
          <div className="settings-system-actions">
            <button className="workbench-btn" onClick={() => setConfirm(false)}>
              {t('cancelAction')}
            </button>
            <button className="workbench-btn" onClick={() => void refresh(true)}>
              {t('confirmAction')}
            </button>
          </div>
        </ConfirmDialog>
      )}
      {files.length > 0 && (
        <label className="wb-field">
          {t('diagnosticsLogs')}
          <select
            className="workbench-select"
            value={file?.name}
            onChange={(event) => setSelected(event.target.value)}
          >
            {files.map((file) => (
              <option key={file.name}>{file.name}</option>
            ))}
          </select>
        </label>
      )}
      {file ? (
        <>
          <small>{new Intl.NumberFormat(locale).format(file.bytes)} B</small>
          <pre className="settings-log-text" aria-label={t('diagnosticsLogs')}>
            {file.text}
          </pre>
        </>
      ) : (
        <p>{t('logsEmpty')}</p>
      )}
      {error && (
        <p role="alert" className="wb-error">
          {t('logs_unavailable')}
        </p>
      )}
    </section>
  );
}
