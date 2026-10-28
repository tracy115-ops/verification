import { Plus, MessageSquare, Search } from 'lucide-react';
import { useState } from 'react';
import type { Conversations } from '../../app/useConversations';
import { useI18n } from '../../shared/i18n/context';
import { SessionActions } from './SessionActions';
import { ConversationSearch } from './ConversationSearch';

export function SessionHistory({ actions, open }: { actions: Conversations; open: () => void }) {
  const { t } = useI18n();
  const [searching, setSearching] = useState(false);
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
              <SessionActions session={session} actions={actions} />
            </div>
          ))}
      </div>
      {searching && <ConversationSearch actions={actions} close={() => setSearching(false)} open={open} />}
    </section>
  );
}
