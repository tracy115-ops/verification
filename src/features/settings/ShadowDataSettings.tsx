import { useEffect, useState } from 'react';
import {
  createPersonalShadow,
  exportPersonalShadow,
  readPersonalShadow,
  type ShadowStatus,
} from '../../services/personal-shadow';
import { downloadText, parseBackup } from '../../services/personal-backup';
import type { ShadowRestorePreview } from './ShadowRestoreDialog';
import { ShadowCopyList } from './ShadowCopyList';
import { hasDesktopBridge } from '../../services/agent-api';
import { isMessageKey, useI18n } from '../../shared/i18n/context';

export function ShadowDataSettings({
  blocked,
  run,
  previewRestore,
}: {
  blocked: boolean;
  run: (task: () => Promise<void>) => Promise<void>;
  previewRestore: (preview: ShadowRestorePreview) => void;
}) {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<ShadowStatus>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
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
  const selected = status?.snapshots.find((copy) => copy.id === selectedId) ?? status?.snapshots[0];
  const count = new Intl.NumberFormat(locale);
  async function check(create: boolean) {
    if (create) setSelectedId(null);
    setError('');
    setStatus(undefined);
    await run(async () => setStatus(await (create ? createPersonalShadow() : readPersonalShadow())));
  }
  async function exportCopy(restore = false) {
    if (!selected || !status) return;
    const verified = status;
    setStatus(undefined);
    setError('');
    await run(async () => {
      const text = await exportPersonalShadow(selected);
      if (restore) previewRestore({ backup: parseBackup(text), snapshot: selected });
      else downloadText(`verification-shadow-${selected.id}.json`, text);
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
          disabled={blocked || !selected || !desktop}
          onClick={() => void exportCopy()}
        >
          {t('shadowExport')}
        </button>
        <button
          className="workbench-btn wb-primary"
          disabled={blocked || !selected || !desktop}
          onClick={() => void exportCopy(true)}
        >
          {t('shadowRestorePreview')}
        </button>
      </div>
      {!desktop && <p className="wb-muted">{t('shadowDesktop')}</p>}
      {status && <p role="status">{t(selected ? 'shadowVerified' : 'shadowEmpty')}</p>}
      {!!status?.snapshots.length && (
        <ShadowCopyList
          snapshots={status.snapshots}
          selected={selected?.id}
          disabled={blocked}
          select={setSelectedId}
        />
      )}
      {selected && (
        <dl className="settings-shadow-summary">
          <dt>{t('shadowBytes')}</dt>
          <dd>{count.format(selected.bytes)}</dd>
          <dt>SHA-256</dt>
          <dd>
            <code>{selected.sha256}</code>
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
