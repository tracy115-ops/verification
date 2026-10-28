import { MessageSquare, Play } from 'lucide-react';
import type { Conversations } from '../../app/useConversations';
import { useI18n } from '../../shared/i18n/context';
import { Status } from '../../shared/components/Status';

export function RunRecords({
  actions,
  openSession,
}: {
  actions: Conversations;
  openSession: (id: string, runId: string) => void;
}) {
  const { t, locale } = useI18n();
  const records = actions.sessions.flatMap((session) => session.runs.map((run) => ({ session, run })));
  if (!records.length)
    return (
      <section className="run-empty">
        <span className="wb-icon-tile">
          <Play size={26} />
        </span>
        <h2>{t('noRunRecords')}</h2>
        <p>{t('recordsHint')}</p>
      </section>
    );
  return (
    <section className="run-records">
      <p className="wb-muted">{t('recordsHint')}</p>
      {records
        .slice()
        .reverse()
        .map(({ session, run }) => (
          <article key={run.id} className="run-record">
            <div>
              <h3>{run.snapshot.definition.name}</h3>
              <small>
                {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                  new Date(run.createdAt),
                )}{' '}
                · r{run.snapshot.revision}
              </small>
              <p>{session.title}</p>
              <Status tone={run.status === 'completed' ? 'success' : 'neutral'}>
                {t(
                  run.status === 'completed'
                    ? run.scope === 'verification'
                      ? 'workflowComplete'
                      : 'designComplete'
                    : run.status === 'awaiting_review'
                      ? 'reviewStep'
                      : run.status === 'cancelled'
                        ? 'cancelledRun'
                        : run.status === 'failed'
                          ? 'failedStep'
                          : 'interruptedStep',
                )}
              </Status>
            </div>
            <button
              className="workbench-btn"
              disabled={actions.busy}
              onClick={() => openSession(session.id, run.id)}
            >
              <MessageSquare size={15} />
              {t('openConversation')}
            </button>
          </article>
        ))}
    </section>
  );
}
