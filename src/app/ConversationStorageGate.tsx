import { useEffect, useState, type ReactNode } from 'react';
import {
  bootConversationStorage,
  CONVERSATION_STORE_MODE,
  requiresConversationBoot,
} from '../services/conversation-storage';
import { isMessageKey, useI18n } from '../shared/i18n/context';
import { ConfirmDialog } from '../features/settings/ConfirmDialog';

export function ConversationStorageGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [ready, setReady] = useState(() => !requiresConversationBoot());
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    if (ready) return;
    let active = true;
    setError('');
    void bootConversationStorage()
      .then(() => {
        if (active) setReady(true);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      active = false;
    };
  }, [ready, attempt]);
  if (ready) return children;
  return (
    <main className="conversation-storage-gate">
      <h1>{t('storeTitle')}</h1>
      {!error ? (
        <p role="status">{t('storeBoot')}</p>
      ) : (
        <>
          <p role="alert">{t('storeBootFailed')}</p>
          <p className="wb-error">{t(isMessageKey(error) ? error : 'store_unavailable')}</p>
          <div className="settings-system-actions">
            <button className="workbench-btn wb-primary" onClick={() => setAttempt((n) => n + 1)}>
              {t('storeReadRetry')}
            </button>
            <button className="workbench-btn" onClick={() => setFallback(true)}>
              {t('storeFallback')}
            </button>
          </div>
        </>
      )}
      {fallback && (
        <ConfirmDialog title={t('storeFallback')} busy={false} onCancel={() => setFallback(false)}>
          <p>{t('storeFallbackHint')}</p>
          <div className="settings-system-actions">
            <button className="workbench-btn" onClick={() => setFallback(false)}>
              {t('cancelAction')}
            </button>
            <button
              className="workbench-btn wb-danger"
              onClick={() => {
                localStorage.removeItem(CONVERSATION_STORE_MODE);
                location.reload();
              }}
            >
              {t('storeFallback')}
            </button>
          </div>
        </ConfirmDialog>
      )}
    </main>
  );
}
