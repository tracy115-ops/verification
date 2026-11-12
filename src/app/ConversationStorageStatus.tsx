import { useState, useSyncExternalStore } from 'react';
import {
  conversationStorageState,
  retryConversationStorage,
  subscribeConversationStorage,
} from '../services/conversation-storage';
import { downloadText, exportPersonalData } from '../services/personal-backup';
import { isMessageKey, useI18n } from '../shared/i18n/context';

export function ConversationStorageStatus() {
  const state = useSyncExternalStore(subscribeConversationStorage, conversationStorageState);
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!state.error) return null;
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(false);
    try {
      await task();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="conversation-storage-warning" role="alert">
      <strong>{t('storeFailure')}</strong>
      <p>{t(state.error && isMessageKey(state.error) ? state.error : 'store_unavailable')}</p>
      <div className="settings-system-actions">
        <button className="workbench-btn" disabled={busy} onClick={() => void run(retryConversationStorage)}>
          {t('storeRetry')}
        </button>
        <button
          className="workbench-btn"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              downloadText('conversation-uncommitted-recovery.json', await exportPersonalData(true));
            })
          }
        >
          {t('storeExport')}
        </button>
      </div>
      {error && <p>{t('data_operation_failed')}</p>}
    </section>
  );
}
