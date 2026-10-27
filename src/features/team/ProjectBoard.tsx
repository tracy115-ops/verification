import { useState } from 'react';
import type { TeamActions } from './useTeam';
import { readiness } from '../../domain/team/rules';
import { useI18n } from '../../shared/i18n/context';
import { Status } from '../../shared/components/Status';
import { ScenarioEditor } from './ScenarioEditor';
import { AnalysisExchange } from './AnalysisExchange';
import { FactorList } from './FactorList';
import { ScenarioCreate } from './ScenarioCreate';

export function ProjectBoard({ actions }: { actions: TeamActions }) {
  const { t, locale } = useI18n();
  const project = actions.project!;
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState('all');
  const [editLock, setEditLock] = useState(false);
  const selected = project.scenarios.find((item) => item.id === selectedId) ?? project.scenarios[0];
  const editable = ['admin', 'editor'].includes(actions.member?.role ?? '');
  const person = (id: string) => actions.members.find((item) => item.id === id)?.name ?? t('team_unassigned');
  const number = new Intl.NumberFormat(locale);
  const visible = project.scenarios.filter(
    (item) =>
      filter === 'all' ||
      (filter === 'mine' ? item.ownerId === actions.member?.id : item.review?.decision !== 'accepted'),
  );
  return (
    <div className="team-project-board">
      <header className="team-board-heading">
        <div>
          <h2>{project.title}</h2>
          <span className="wb-muted">
            {t(project.mode === 'black_box' ? 'team_black_box' : 'team_collaborative')} · r{project.revision}{' '}
            · {person(project.updatedBy)}
          </span>
        </div>
        <button className="workbench-btn" disabled={actions.busy} onClick={() => void actions.refresh()}>
          {t('team_refresh')}
        </button>
      </header>
      <div className="wb-banner">{t('team_design_only')}</div>
      <details className="team-source">
        <summary>{t('team_topic_interfaces')}</summary>
        <pre>{project.topic}</pre>
        {project.interfaces.map((item) => (
          <article key={item.id}>
            <h3>
              {item.id} · {item.name}
            </h3>
            <pre>{item.contract || t('team_contract_unknown')}</pre>
          </article>
        ))}
      </details>
      <div className="team-board-actions">
        <div className="team-actions">
          {editable && (
            <button
              className="workbench-btn wb-primary"
              disabled={actions.busy || !!project.factors.length || !!project.scenarios.length}
              onClick={() => void actions.command({ type: 'suggest' })}
            >
              {t('team_suggest')}
            </button>
          )}
          <small className="wb-muted">{t('team_rule_suggestions')}</small>
        </div>
        <AnalysisExchange key={project.id} actions={actions} />
      </div>
      {!!project.questions.length && (
        <details className="team-questions" open>
          <summary>{t('team_questions')}</summary>
          <ul>
            {project.questions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="team-board-columns">
        <FactorList actions={actions} />
        <section className="team-scenario-list">
          {editable && <ScenarioCreate actions={actions} created={setSelectedId} />}
          <div className="team-list-heading">
            <h3>
              {t('team_scenarios')} · {number.format(project.scenarios.length)}
            </h3>
            <select
              aria-label={t('team_filter')}
              className="workbench-select"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">{t('team_all')}</option>
              <option value="pending">{t('team_pending')}</option>
              <option value="mine">{t('team_mine')}</option>
            </select>
          </div>
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
          <ScenarioEditor key={selected.id} actions={actions} scenario={selected} onDirty={setEditLock} />
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
