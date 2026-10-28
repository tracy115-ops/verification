import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Conversations } from '../../app/useConversations';
import type { ConversationSession } from '../../domain/runtime/types';
import { useI18n } from '../../shared/i18n/context';

export function SessionActions({
  session,
  actions,
}: {
  session: ConversationSession;
  actions: Conversations;
}) {
  const { t } = useI18n();
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<'rename' | 'delete' | null>(null);
  const [title, setTitle] = useState('');
  const [failed, setFailed] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const blocked =
    actions.busy ||
    !!session.activeTurnId ||
    session.runs.some((run) => ['ready', 'running', 'interrupted'].includes(run.status));
  useEffect(() => {
    if (mode) dialog.current?.showModal();
    else dialog.current?.close();
  }, [mode]);
  function begin(next: 'rename' | 'delete') {
    menu.current?.hidePopover();
    setTitle(session.title.replace(/^#+\s*/, '').split('\n')[0]);
    setFailed(false);
    setMode(next);
  }
  function submit() {
    const success =
      mode === 'rename' ? actions.renameSession(session.id, title) : actions.deleteSession(session.id);
    if (success) setMode(null);
    else setFailed(true);
  }
  return (
    <>
      <button
        className="workbench-btn wb-text session-history-more"
        aria-label={t('sessionActions')}
        title={t('sessionActions')}
        popoverTarget={id}
        disabled={actions.busy}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPosition({
            top: Math.min(rect.bottom + 4, window.innerHeight - 110),
            left: Math.max(8, rect.right - 164),
          });
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      <div id={id} ref={menu} popover="auto" className="session-history-menu" style={position}>
        <button className="workbench-btn wb-text" onClick={() => begin('rename')}>
          <Pencil size={14} />
          {t('renameSession')}
        </button>
        <button
          className="workbench-btn wb-text"
          disabled={blocked}
          onClick={() => begin('delete')}
          title={blocked ? t('sessionDeleteBlocked') : undefined}
        >
          <Trash2 size={14} />
          {t('deleteSession')}
        </button>
      </div>
      <dialog
        ref={dialog}
        className="session-management-dialog"
        onCancel={() => setMode(null)}
        onClose={() => setMode(null)}
        aria-labelledby={`${id}-title`}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <h2 id={`${id}-title`}>{t(mode === 'delete' ? 'deleteSession' : 'renameSession')}</h2>
          {mode === 'rename' ? (
            <label className="wb-field">
              {t('sessionName')}
              <input
                className="workbench-input"
                value={title}
                maxLength={120}
                autoFocus
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
          ) : (
            <>
              <p className="session-delete-title">{session.title || t('untitledSession')}</p>
              <p>{t('sessionDeleteHint')}</p>
            </>
          )}
          {failed && (
            <p className="wb-error" role="alert">
              {t('sessionManageFailed')}
            </p>
          )}
          <div className="session-management-actions">
            <button type="button" className="workbench-btn" onClick={() => setMode(null)}>
              {t('cancelSessionAction')}
            </button>
            <button
              type="submit"
              className={`workbench-btn ${mode === 'delete' ? 'wb-danger' : 'wb-primary'}`}
              disabled={actions.busy || (mode === 'rename' ? !title.trim() : blocked)}
            >
              {t(mode === 'delete' ? 'confirmDeleteSession' : 'saveSessionName')}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
