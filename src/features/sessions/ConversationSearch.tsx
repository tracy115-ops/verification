import { useEffect, useRef, useState } from 'react';
import type { Conversations } from '../../app/useConversations';
import { useI18n } from '../../shared/i18n/context';
import { SessionActions } from './SessionActions';

export function ConversationSearch({
  actions,
  close,
  open,
  openAssets,
}: {
  actions: Conversations;
  close: () => void;
  open: () => void;
  openAssets: () => void;
}) {
  const { t, locale } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [context, setContext] = useState<{ sessionId: string; x: number; y: number }>();
  useEffect(() => {
    dialog.current?.showModal();
    input.current?.focus();
  }, []);
  const term = query.trim().toLocaleLowerCase();
  const matches = actions.sessions
    .slice()
    .reverse()
    .filter((session) =>
      `${session.title}\n${session.runs.map((run) => run.spec).join('\n')}\n${session.messages
        .filter((message) => message.role === 'user')
        .map((message) => message.text)
        .join('\n')}`
        .toLocaleLowerCase()
        .includes(term),
    );
  return (
    <dialog
      ref={dialog}
      className="session-search-dialog"
      aria-label={t('searchConversations')}
      onClose={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onCancel={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <header>
        <h2>{t('searchConversations')}</h2>
        <button className="workbench-btn wb-text" onClick={close}>
          {t('closeReview')}
        </button>
      </header>
      <div className="session-search-input">
        <input
          ref={input}
          className="workbench-input"
          type="search"
          aria-label={t('searchConversationPlaceholder')}
          placeholder={t('searchConversationPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <small>
          {new Intl.NumberFormat(locale).format(matches.length)} /{' '}
          {new Intl.NumberFormat(locale).format(actions.sessions.length)}
        </small>
      </div>
      <div className="session-search-results">
        {matches.map((session) => {
          const at = session.runs.at(-1)?.createdAt ?? session.messages.at(-1)?.createdAt;
          return (
            <div
              className="session-search-row"
              key={session.id}
              onContextMenu={(event) => {
                event.preventDefault();
                setContext({ sessionId: session.id, x: event.clientX, y: event.clientY });
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                setContext({ sessionId: session.id, x: rect.left + 20, y: rect.bottom });
              }}
            >
              <button
                className="session-search-result"
                onClick={() => {
                  actions.setActiveId(session.id);
                  close();
                  open();
                }}
              >
                <strong>{session.title.replace(/^#+\s*/, '').split('\n')[0] || t('untitledSession')}</strong>
                {at && Number.isFinite(Date.parse(at)) && (
                  <small>
                    {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
                      new Date(at),
                    )}
                  </small>
                )}
              </button>
              <SessionActions
                session={session}
                actions={actions}
                context={context?.sessionId === session.id ? context : undefined}
                openAssets={() => {
                  close();
                  openAssets();
                }}
              />
            </div>
          );
        })}
        {!matches.length && <p className="wb-muted">{t('noMatchingConversations')}</p>}
      </div>
    </dialog>
  );
}
