import { useState } from 'react';
import { collaboration } from '../../domain/team/collaboration';
import { useI18n } from '../../shared/i18n/context';
import type { TeamActions } from './useTeam';
import { ContributionImport } from './ContributionImport';
import { ContributionReview } from './ContributionReview';
import { AgentApiGuide } from './AgentApiGuide';

export function ContributionBoard({ actions }: { actions: TeamActions }) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState('');
  const [importing, setImporting] = useState(false);
  const entries = collaboration(actions.project!).contributions.flatMap((proposal) =>
    proposal.items.map((item) => ({ proposal, item })),
  );
  const current =
    entries.find(({ proposal, item }) => `${proposal.id}:${item.id}` === selected) ??
    entries.find(({ item }) => item.status === 'pending') ??
    entries.at(-1);
  return (
    <section className="collab-contributions">
      <div className="collab-toolbar">
        <p className="wb-muted">{t('collab_apply_hint')}</p>
        <AgentApiGuide project={actions.project!} />
        {actions.member?.role !== 'viewer' && (
          <button className="workbench-btn wb-primary" onClick={() => setImporting(true)}>
            {t('collab_import')}
          </button>
        )}
      </div>
      {!entries.length ? (
        <p className="collab-empty">{t('collab_empty_proposals')}</p>
      ) : (
        <div className="collab-split">
          <div className="collab-list">
            {entries.map(({ proposal, item }) => (
              <button
                key={`${proposal.id}:${item.id}`}
                className="collab-list-item"
                aria-pressed={current?.item === item}
                onClick={() => setSelected(`${proposal.id}:${item.id}`)}
              >
                <span>
                  {t(`collab_${item.kind}`)} · {t(`collab_${item.status}`)}
                </span>
                <strong>{'title' in item.value ? item.value.title : item.value.name}</strong>
                <small>
                  {proposal.source.name} · r{proposal.baseRevision} ·{' '}
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
                    new Date(proposal.at),
                  )}
                </small>
              </button>
            ))}
          </div>
          {current && (
            <ContributionReview
              key={`${current.proposal.id}:${current.item.id}`}
              actions={actions}
              {...current}
            />
          )}
        </div>
      )}
      <ContributionImport open={importing} close={() => setImporting(false)} actions={actions} />
    </section>
  );
}
