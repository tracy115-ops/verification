import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { hasDesktopBridge } from '../../services/agent-api';
import { conversationStorageState, subscribeConversationStorage } from '../../services/conversation-storage';
import {
  previewConversationMigration,
  migrateConversations,
  type ConversationMigrationPreview,
} from '../../services/conversation-migration';
import { useDraftStore } from '../../shared/drafts/context';
import { isMessageKey, useI18n } from '../../shared/i18n/context';
import { ConfirmDialog } from './ConfirmDialog';

export function ConversationStoreSettings({ blocked }: { blocked: boolean }) {
  const { t, locale } = useI18n();
  const drafts = useDraftStore();
  const state = useSyncExternalStore(subscribeConversationStorage, conversationStorageState);
  const [preview, setPreview] = useState<ConversationMigrationPreview>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(true);
  const allowed = useRef(!blocked);
  allowed.current = !blocked;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function inspect() {
    setBusy(true);
    setError('');
    try {
      const value = await previewConversationMigration();
      if (active.current) setPreview(value);
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function activate() {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      await migrateConversations(preview, () => active.current && allowed.current && !drafts?.count());
      location.reload();
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (active.current) setBusy(false);
    }
  }
  if (!hasDesktopBridge()) return null;
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  return (
    <section className="settings-conversation-store">
      <h3>{t('storeTitle')}</h3>
      <p className="wb-muted">{t('storeScope')}</p>
      <p role="status">
        {t(
          state.phase === 'browser'
            ? 'storeBrowser'
            : state.phase === 'saved'
              ? 'storeSaved'
              : state.phase === 'saving'
                ? 'storeSaving'
                : 'storeFailure',
        )}
      </p>
      {state.phase !== 'browser' ? (
        <p>
          {t('storeRevision')} · {number(state.revision)}
        </p>
      ) : (
        <button className="workbench-btn" disabled={busy || blocked} onClick={() => void inspect()}>
          {t('storeInspect')}
        </button>
      )}
      {preview && (
        <ConfirmDialog title={t('storePreview')} busy={busy} onCancel={() => setPreview(undefined)}>
          <p>{t(preview.target.payload === null ? 'storeNew' : 'storeExisting')}</p>
          <p>
            {t('storeSourceCount')} · {number(JSON.parse(preview.source).length)}
          </p>
          <p>
            {t('storeTargetCount')} · {number(JSON.parse(preview.target.payload ?? '[]').length)}
          </p>
          <p>
            {t('storeRevision')} · {number(preview.target.revision)}
          </p>
          {error && (
            <p role="alert" className="wb-error">
              {t(isMessageKey(error) ? error : 'store_unavailable')}
            </p>
          )}
          <div className="settings-system-actions">
            <button className="workbench-btn" disabled={busy} onClick={() => setPreview(undefined)}>
              {t('cancelAction')}
            </button>
            <button
              className="workbench-btn wb-primary"
              disabled={busy || blocked}
              onClick={() => void activate()}
            >
              {t('storeActivate')}
            </button>
          </div>
        </ConfirmDialog>
      )}
      {error && !preview && (
        <p role="alert" className="wb-error">
          {t(isMessageKey(error) ? error : 'store_unavailable')}
        </p>
      )}
      {busy && <p role="status">{t('dataWorking')}</p>}
    </section>
  );
}
