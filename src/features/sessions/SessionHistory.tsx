import { Plus, MessageSquare, Search } from 'lucide-react';
import { useState } from 'react';
import type { Conversations } from '../../app/useConversations';
import { useI18n } from '../../shared/i18n/context';
import { SessionActions } from './SessionActions';
import { ConversationSearch } from './ConversationSearch';

export function SessionHistory({
  actions,
  open,
  openAssets,
}: {
  actions: Conversations;
  open: () => void;
  openAssets: () => void;
}) {
  const { t } = useI18n();
  const [searching, setSearching] = useState(false);
  const [context, setContext] = useState<{ sessionId: string; x: number; y: number }>();
  return (
    <section className="session-history">
      <button
        className="workbench-btn session-history-new"
        disabled={actions.busy}
        onClick={() => {
          actions.newSession();
          open();
        }}
      >
        <Plus size={16} />
        <span>{t('newSession')}</span>
      </button>
      <div className="session-history-heading">
        <h2>{t('sessionHistory')}</h2>
        <button
          className="workbench-btn wb-text"
          disabled={actions.busy}
          aria-label={t('searchConversations')}
          title={t('searchConversations')}
          onClick={() => setSearching(true)}
        >
          <Search size={15} />
        </button>
      </div>
      <div className="session-history-list">
        {actions.sessions
          .slice()
          .reverse()
          .map((session) => (
            <div
              key={session.id}
              className={`session-history-row ${actions.activeId === session.id ? 'is-active' : ''}`}
              onContextMenu={(event) => {
                event.preventDefault();
                if (!actions.busy) setContext({ sessionId: session.id, x: event.clientX, y: event.clientY });
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                if (!actions.busy) setContext({ sessionId: session.id, x: rect.left + 20, y: rect.bottom });
              }}
            >
              <button
                disabled={actions.busy}
                className={`session-history-item ${actions.activeId === session.id ? 'is-active' : ''}`}
                onClick={() => {
                  actions.setActiveId(session.id);
                  open();
                }}
                title={session.title || t('untitledSession')}
              >
                <MessageSquare size={15} />
                <span>{session.title.replace(/^#+\s*/, '').split('\n')[0] || t('untitledSession')}</span>
              </button>
              <SessionActions
                session={session}
                actions={actions}
                openAssets={openAssets}
                context={context?.sessionId === session.id ? context : undefined}
              />
            </div>
          ))}
      </div>
      {searching && <ConversationSearch actions={actions} close={() => setSearching(false)} open={open} />}
    </section>
  );
}
