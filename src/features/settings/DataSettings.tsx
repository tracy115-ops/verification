import { useRef, useState } from 'react';
import * as backup from '../../services/personal-backup';
import { clearUpdateCache } from '../../services/system-api';
import { hasDesktopBridge } from '../../services/agent-api';
import { isMessageKey, useI18n } from '../../shared/i18n/context';
import { ConfirmDialog } from './ConfirmDialog';
export function DataSettings({ blocked }: { blocked: boolean }) {
  const { t, locale } = useI18n();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<backup.PersonalBackup | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(false);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'data_operation_failed',
      );
    } finally {
      setBusy(false);
    }
  }
  async function read(file: File | undefined) {
    if (!file) return;
    await run(async () => {
      if (file.size > 20 * 1024 * 1024) throw new Error('data_backup_limit');
      setPending(backup.parseBackup(await file.text()));
    });
  }
  return (
    <section className="settings-system-panel">
      <h2>{t('dataManagement')}</h2>
      <p className="wb-muted">{t('dataScope')}</p>
      <p>
        {t('dataBytes')} · {new Intl.NumberFormat(locale).format(backup.personalDataBytes())} B
      </p>
      <p className="wb-muted">{t('dataBackupHint')}</p>
      <div className="settings-system-actions">
        <button
          className="workbench-btn"
          disabled={busy || blocked}
          onClick={() =>
            void run(async () =>
              backup.downloadText(
                `verification-backup-${new Date().toISOString().slice(0, 10)}.json`,
                await backup.exportPersonalData(),
              ),
            )
          }
        >
          {t('dataBackup')}
        </button>
        <button className="workbench-btn" disabled={busy || blocked} onClick={() => file.current?.click()}>
          {t('dataImport')}
        </button>
        <button
          className="workbench-btn"
          disabled={busy || blocked}
          onClick={() => setPending(backup.emptyPersonalData())}
        >
          {t('dataReset')}
        </button>
      </div>
      <input
        ref={file}
        type="file"
        hidden
        accept=".json,application/json"
        onChange={(event) => {
          void read(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {pending && (
        <ConfirmDialog title={t('dataImport')} busy={busy} onCancel={() => setPending(null)}>
          <p>{t('dataConfirm')}</p>
          <div className="settings-system-actions">
            <button className="workbench-btn" disabled={busy} onClick={() => setPending(null)}>
              {t('cancelAction')}
            </button>
            <button
              className="workbench-btn wb-primary"
              disabled={busy || blocked}
              onClick={() =>
                void run(async () => {
                  await backup.restorePersonalData(pending);
                  location.reload();
                })
              }
            >
              {t('confirmAction')}
            </button>
          </div>
        </ConfirmDialog>
      )}
      <button
        className="workbench-btn"
        disabled={busy || !hasDesktopBridge()}
        onClick={() =>
          void run(async () => {
            await clearUpdateCache();
            setNotice(true);
          })
        }
      >
        {t('clearUpdateCache')}
      </button>
      {notice && <p role="status">{t('updateCacheCleared')}</p>}
      {blocked && <p className="wb-muted">{t('dataBusy')}</p>}
      {busy && <p role="status">{t('dataWorking')}</p>}
      {error && (
        <p role="alert" className="wb-error">
          {isMessageKey(error) ? t(error) : t('data_operation_failed')}
        </p>
      )}
    </section>
  );
}
