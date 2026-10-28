import { Plus, MessageSquare } from 'lucide-react';
import type { Conversations } from '../../app/useConversations';
import { useI18n } from '../../shared/i18n/context';

export function SessionHistory({ actions, open }: { actions: Conversations; open: () => void }) {
  const { t } = useI18n();
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
      <h2>{t('sessionHistory')}</h2>
      <div className="session-history-list">
        {actions.sessions
          .slice()
          .reverse()
          .map((session) => (
            <button
              key={session.id}
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
          ))}
      </div>
    </section>
  );
}
