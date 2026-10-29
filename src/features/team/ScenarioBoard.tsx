import { useCallback, useState } from 'react';
import type { TeamActions } from './useTeam';
import { readiness } from '../../domain/team/rules';
import { useI18n } from '../../shared/i18n/context';
import { Status } from '../../shared/components/Status';
import { ScenarioEditor } from './ScenarioEditor';
import { ScenarioCreate } from './ScenarioCreate';

export function ScenarioBoard({
  actions,
  onDirty,
}: {
  actions: TeamActions;
  onDirty: (dirty: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const project = actions.project!;
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState('all');
  const [editLock, setEditLock] = useState(false);
  const reportDirty = useCallback(
    (value: boolean) => {
      setEditLock(value);
      onDirty(value);
    },
    [onDirty],
  );
  const editable = ['admin', 'editor'].includes(actions.member?.role ?? '');
  const reviewer = ['admin', 'reviewer'].includes(actions.member?.role ?? '');
  const person = (id: string) => actions.members.find((item) => item.id === id)?.name ?? t('team_unassigned');
  const visible = project.scenarios.filter(
    (item) =>
      filter === 'all' ||
      (filter === 'pending'
        ? item.review?.decision !== 'accepted'
        : reviewer
          ? item.review?.decision !== 'accepted' && !readiness(item, project).length
          : item.ownerId === actions.member?.id),
  );
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  return (
    <div className="team-project-board">
      <div className="team-step-content-heading">
        <h2>{t('teamScenarioStep')}</h2>
        <button
          className="workbench-btn"
          disabled={actions.busy || editLock}
          onClick={() => void actions.refresh()}
        >
          {t('team_refresh')}
        </button>
      </div>
      <div className="team-board-columns">
        <section className="team-scenario-list">
          <div className="team-list-heading">
            <h3>
              {t('team_scenarios')} · {new Intl.NumberFormat(locale).format(project.scenarios.length)}
            </h3>
            {editable && <ScenarioCreate actions={actions} created={setSelectedId} disabled={editLock} />}
          </div>
          <select
            aria-label={t('team_filter')}
            className="workbench-select"
            disabled={editLock}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">{t('team_all')}</option>
            <option value="pending">{t('team_pending')}</option>
            <option value="mine">{t(reviewer ? 'teamReadyForReview' : 'team_mine')}</option>
          </select>
          {visible.map((scenario) => (
            <button
              key={scenario.id}
              className={`team-scenario-item ${selected?.id === scenario.id ? 'is-selected' : ''}`}
              disabled={editLock && selected?.id !== scenario.id}
              onClick={() => setSelectedId(scenario.id)}
            >
              <code>{scenario.id}</code>
              <strong>{scenario.title}</strong>
              <small>
                {scenario.interfaceIds.join(', ')} · {person(scenario.ownerId)}
              </small>
              <Status tone={scenario.review?.decision === 'accepted' ? 'success' : 'warning'}>
                {t(
                  scenario.review?.decision === 'accepted'
                    ? 'team_accepted'
                    : scenario.review?.decision === 'needs_changes'
                      ? 'team_changes'
                      : readiness(scenario, project).length
                        ? 'team_gaps'
                        : 'team_awaiting_review',
                )}
              </Status>
            </button>
          ))}
          {!visible.length && <p className="wb-muted">{t('team_no_scenarios')}</p>}
        </section>
        {selected && (
          <ScenarioEditor key={selected.id} actions={actions} scenario={selected} onDirty={reportDirty} />
        )}
      </div>
      <details className="team-history">
        <summary>{t('team_history')}</summary>
        <ol>
          {actions.history.map((item) => (
            <li key={item.revision}>
              r{item.revision} · {person(item.actor)} ·{' '}
              {t(`team_action_${item.action}` as 'team_action_create')} ·{' '}
              {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
                new Date(item.at),
              )}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
