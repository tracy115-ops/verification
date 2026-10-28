import { useState } from 'react';
import { useI18n } from '../../shared/i18n/context';
import { collaboration } from '../../domain/team/collaboration';
import type { TeamActions } from './useTeam';
import { ScenarioBoard } from './ScenarioBoard';
import { ContributionBoard } from './ContributionBoard';
import { CaseBoard } from './CaseBoard';

export function ProjectBoard({ actions }: { actions: TeamActions }) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<'design' | 'proposals' | 'cases'>('design');
  const [dirty, setDirty] = useState(false);
  const state = collaboration(actions.project!);
  const pending = state.contributions
    .flatMap((item) => item.items)
    .filter((item) => item.status === 'pending').length;
  return (
    <div className="collab-project">
      <nav className="collab-tabs" aria-label={t('team')}>
        {(['design', 'proposals', 'cases'] as const).map((item) => (
          <button
            key={item}
            className="workbench-btn"
            disabled={dirty && tab !== item}
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
          >
            {t(
              item === 'design'
                ? 'collab_design'
                : item === 'proposals'
                  ? 'collab_proposals'
                  : 'collab_cases',
            )}
            {item !== 'design' &&
              ` · ${new Intl.NumberFormat(locale).format(item === 'proposals' ? pending : state.cases.length)}`}
          </button>
        ))}
      </nav>
      {tab === 'design' ? (
        <ScenarioBoard actions={actions} onDirty={setDirty} />
      ) : (
        <>
          <h2>{actions.project!.title}</h2>
          {tab === 'proposals' ? <ContributionBoard actions={actions} /> : <CaseBoard actions={actions} />}
        </>
      )}
    </div>
  );
}
