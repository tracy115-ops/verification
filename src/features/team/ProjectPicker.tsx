import { useState } from 'react';
import type { TeamActions } from './useTeam';
import { useI18n } from '../../shared/i18n/context';
import { ConnectionSteps } from './ConnectionSteps';

export function ProjectPicker({
  actions,
  create,
  changeServer,
}: {
  actions: TeamActions;
  create: () => void;
  changeServer?: () => void;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const visible = actions.projects.filter((item) =>
    `${item.title} ${item.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <section className="team-project-picker" aria-label={t('team_select_project')}>
      <ConnectionSteps
        step={3}
        canChangeServer={Boolean(changeServer)}
        back={
          actions.busy
            ? undefined
            : (step) => (step === 1 && changeServer ? changeServer() : actions.logout())
        }
      />
      <header>
        <div>
          <h1>{t('team_select_project')}</h1>
          <p className="wb-muted">{t('team_shared_hint')}</p>
        </div>
        {['admin', 'editor'].includes(actions.member!.role) && (
          <button className="workbench-btn wb-primary" disabled={actions.busy} onClick={create}>
            {t('team_new_project')}
          </button>
        )}
      </header>
      <input
        className="workbench-input"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('teamProjectSearch')}
        aria-label={t('teamProjectSearch')}
      />
      {!visible.length && (
        <p className="collab-empty">
          {t(actions.projects.length ? 'assetNoMatches' : 'team_choose_or_create')}
        </p>
      )}
      <div className="team-project-grid">
        {visible.map((project) => (
          <button
            className="team-project-card"
            aria-label={project.title}
            key={project.id}
            disabled={actions.busy}
            onClick={() => void actions.select(project.id)}
          >
            <strong>{project.title}</strong>
            <span>
              {t(project.mode === 'black_box' ? 'team_black_box' : 'team_collaborative')} · r
              {project.revision}
            </span>
            <small>
              {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                new Date(project.updatedAt),
              )}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
