import { useEffect, useState } from 'react';
import {
  createPersonalShadow,
  exportPersonalShadow,
  readPersonalShadow,
  type ShadowStatus,
} from '../../services/personal-shadow';
import { downloadText } from '../../services/personal-backup';
import { hasDesktopBridge } from '../../services/agent-api';
import { isMessageKey, useI18n } from '../../shared/i18n/context';

export function ShadowDataSettings({
  blocked,
  run,
}: {
  blocked: boolean;
  run: (task: () => Promise<void>) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<ShadowStatus>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const desktop = hasDesktopBridge();
  useEffect(() => {
    if (!desktop) return;
    let active = true;
    void readPersonalShadow()
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch((error: unknown) => {
        if (active)
          setError(
            typeof error === 'string' ? error : error instanceof Error ? error.message : 'shadow_unavailable',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [desktop]);
  const latest = status?.snapshots[0];
  const count = new Intl.NumberFormat(locale);
  async function check(create: boolean) {
    setError('');
    setStatus(undefined);
    await run(async () => setStatus(await (create ? createPersonalShadow() : readPersonalShadow())));
  }
  async function exportCopy() {
    if (!latest || !status) return;
    const verified = status;
    setStatus(undefined);
    setError('');
    await run(async () => {
      downloadText(`verification-shadow-${latest.id}.json`, await exportPersonalShadow(latest));
      setStatus(verified);
    });
  }
  return (
    <section className="settings-shadow" aria-label={t('shadowTitle')}>
      <h3>{t('shadowTitle')}</h3>
      <p className="wb-muted">{t('shadowHint')}</p>
      <p className="wb-muted">{t('shadowRetentionHint')}</p>
      <div className="settings-system-actions">
        <button
          className="workbench-btn"
          disabled={blocked || !desktop || loading}
          onClick={() => void check(true)}
        >
          {t('shadowCreate')}
        </button>
        <button
          className="workbench-btn"
          disabled={blocked || !desktop || loading}
          onClick={() => void check(false)}
        >
          {t('shadowCheck')}
        </button>
        <button
          className="workbench-btn"
          disabled={blocked || !latest || !desktop}
          onClick={() => void exportCopy()}
        >
          {t('shadowExport')}
        </button>
      </div>
      {!desktop && <p className="wb-muted">{t('shadowDesktop')}</p>}
      {status && <p role="status">{t(latest ? 'shadowVerified' : 'shadowEmpty')}</p>}
      {latest && (
        <dl className="settings-shadow-summary">
          <dt>{t('shadowCreated')}</dt>
          <dd>
            {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
              new Date(latest.createdAt),
            )}
          </dd>
          <dt>{t('shadowRecords')}</dt>
          <dd>
            {count.format(latest.sessions)} / {count.format(latest.transcripts)}
          </dd>
          <dt>{t('shadowBytes')}</dt>
          <dd>{count.format(latest.bytes)}</dd>
          <dt>{t('shadowRetained')}</dt>
          <dd>{count.format(status!.snapshots.length)}</dd>
          <dt>SHA-256</dt>
          <dd>
            <code>{latest.sha256}</code>
          </dd>
        </dl>
      )}
      {error && (
        <p className="wb-error" role="alert">
          {t(isMessageKey(error) ? error : 'shadow_unavailable')}
        </p>
      )}
    </section>
  );
}
