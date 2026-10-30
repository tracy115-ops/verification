import { useState } from 'react';
import { Play } from 'lucide-react';
import type { Conversations } from '../../app/useConversations';
import { useI18n } from '../../shared/i18n/context';
import { RunState } from '../sessions/RunSummary';
import { RunDetails } from './RunDetails';

export function RunRecords({
  actions,
  openSession,
  openAssets,
}: {
  actions: Conversations;
  openSession: (id: string, runId: string) => void;
  openAssets: (id: string, runId: string) => void;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(actions.selectedRunId);
  const records = actions.sessions
    .flatMap((session) => session.runs.map((run) => ({ session, run })))
    .sort((a, b) => Date.parse(b.run.createdAt) - Date.parse(a.run.createdAt));
  const filtered = records.filter(
    ({ session, run }) =>
      (filter === 'all' ||
        (filter === 'attention'
          ? ['failed', 'interrupted', 'awaiting_review'].includes(run.status)
          : run.status === filter)) &&
      `${session.title} ${run.snapshot.definition.name} ${run.id} ${run.errorCode ?? ''}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const current = filtered.find(({ run }) => run.id === selected) ?? filtered[0];
  if (!records.length)
    return (
      <section className="run-empty">
        <span className="wb-icon-tile">
          <Play size={26} />
        </span>
        <h2>{t('noRunRecords')}</h2>
        <p>{t('runPurpose')}</p>
      </section>
    );
  return (
    <section className="run-records">
      <header className="run-records-toolbar">
        <div className="run-records-heading">
          <h1>{t('runs')}</h1>
          <p className="wb-muted">{t('runPurpose')}</p>
        </div>
        <input
          className="workbench-input"
          type="search"
          value={query}
          aria-label={t('runSearch')}
          placeholder={t('runSearch')}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="workbench-select"
          aria-label={t('runFilter')}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">{t('runAll')}</option>
          <option value="attention">{t('runAttention')}</option>
          <option value="completed">{t('successStep')}</option>
          <option value="running">{t('runningStep')}</option>
          <option value="cancelled">{t('cancelledRun')}</option>
        </select>
      </header>
      <div className="run-records-body">
        <div className="run-records-list">
          <small className="wb-muted">
            {new Intl.NumberFormat(locale).format(filtered.length)} /{' '}
            {new Intl.NumberFormat(locale).format(records.length)}
          </small>
          {!filtered.length && <p className="wb-muted">{t('assetNoMatches')}</p>}
          {filtered.map(({ session, run }) => (
            <button
              key={run.id}
              className="run-record"
              aria-pressed={current?.run.id === run.id}
              onClick={() => setSelected(run.id)}
            >
              <strong>{session.title.replace(/^#+\s*/, '').split('\n')[0]}</strong>
              <small>
                {run.snapshot.definition.name} · r{run.snapshot.revision}
              </small>
              <div>
                <RunState run={run} />
                <span>
                  {Object.values(run.steps).filter((step) => step.status === 'succeeded').length} /{' '}
                  {run.plan.length}
                </span>
              </div>
              <small>
                {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                  new Date(run.createdAt),
                )}
              </small>
            </button>
          ))}
        </div>
        {current && (
          <RunDetails
            key={current.run.id}
            run={current.run}
            title={current.session.title}
            busy={actions.isSessionBusy?.(current.session.id) ?? actions.busy}
            openSession={() => openSession(current.session.id, current.run.id)}
            openAssets={() => openAssets(current.session.id, current.run.id)}
          />
        )}
      </div>
    </section>
  );
}
