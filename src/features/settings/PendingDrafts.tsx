import { useSyncExternalStore } from 'react';
import { useDraftStore } from '../../shared/drafts/context';
import type { DraftSection } from '../../shared/drafts/store';
import { useI18n } from '../../shared/i18n/context';
import { ConfirmDialog } from './ConfirmDialog';

export function PendingDrafts({
  close,
  navigate,
  closing,
  quit,
  workflowDirty,
  running,
  error,
  openWorkflow,
}: {
  close: () => void;
  navigate: (section: DraftSection) => void;
  closing: boolean;
  quit: () => void;
  workflowDirty: boolean;
  running: boolean;
  error: boolean;
  openWorkflow: () => void;
}) {
  const store = useDraftStore()!;
  const entries = useSyncExternalStore(store.subscribe, store.snapshot);
  const { t } = useI18n();
  const unsaved = entries.length > 0 || workflowDirty;
  return (
    <ConfirmDialog title={t(closing ? 'draftCloseTitle' : 'draftReview')} busy={false} onCancel={close}>
      <h2>{t(closing ? 'draftCloseTitle' : 'draftReview')}</h2>
      {unsaved && <p className="wb-muted">{t(closing ? 'draftCloseHint' : 'draftScopeHint')}</p>}
      {workflowDirty && (
        <div className="settings-draft-actions">
          <span>{t('draftWorkflowDirty')}</span>
          <button
            className="workbench-btn"
            onClick={() => {
              openWorkflow();
              close();
            }}
          >
            {t('workflow')}
          </button>
        </div>
      )}
      {running && <p>{t('draftTasksRunning')}</p>}
      {!entries.length && !workflowDirty && !running && <p role="status">{t('draftNone')}</p>}
      <ul className="settings-pending-drafts">
        {entries.map((entry) => (
          <li key={entry.id}>
            <strong>
              {entry.title}
              {entry.label && (
                <>
                  {entry.title ? ' / ' : ''}
                  {t(entry.label)}
                </>
              )}
            </strong>
            {entry.busy && <small role="status">{t('draftSaving')}</small>}
            <div className="settings-system-actions">
              <button
                className="workbench-btn"
                onClick={() => {
                  entry.open?.();
                  navigate(entry.section);
                  close();
                }}
              >
                {t('draftReturn')}
              </button>
              <button
                className="workbench-btn wb-text"
                disabled={entry.busy}
                onClick={() => store.discard(entry.id)}
              >
                {t('draftDiscard')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p className="wb-error" role="alert">
          {t('draftCloseFailed')}
        </p>
      )}
      <div className="settings-system-actions">
        <button className="workbench-btn wb-primary" onClick={close}>
          {t('draftKeepWorking')}
        </button>
        {closing && (
          <button
            className="workbench-btn wb-danger"
            disabled={entries.some((entry) => entry.busy)}
            onClick={quit}
          >
            {t(unsaved ? 'draftCloseAnyway' : 'draftClose')}
          </button>
        )}
      </div>
    </ConfirmDialog>
  );
}
