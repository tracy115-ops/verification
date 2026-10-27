import { useState } from 'react';
import { Users } from 'lucide-react';
import { useTeam } from './useTeam';
import { useI18n, isMessageKey } from '../../shared/i18n/context';
import { ProjectForm } from './ProjectForm';
import { ProjectBoard } from './ProjectBoard';
import { TeamMembers } from './TeamMembers';

export function TeamWorkspace() {
  const actions = useTeam();
  const { t } = useI18n();
  const [token, setToken] = useState('');
  const [creating, setCreating] = useState(false);
  return (
    <div className="team-workspace">
      {actions.error && (
        <div className="wb-error team-error" role="alert">
          {isMessageKey(actions.error) ? t(actions.error) : t('team_server_error')}
        </div>
      )}
      {!actions.member ? (
        <section className="team-login">
          <span className="wb-icon-tile">
            <Users size={24} />
          </span>
          <h2>{t('team_join')}</h2>
          <p>{t('team_join_hint')}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              actions.login(token);
            }}
          >
            <label className="wb-field">
              {t('team_access_token')}
              <input
                className="workbench-input"
                type="password"
                autoComplete="off"
                required
                minLength={32}
                maxLength={256}
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </label>
            <button className="workbench-btn wb-primary" type="submit">
              {t('team_login')}
            </button>
          </form>
          <p className="wb-muted">{t('team_start_hint')}</p>
          <code>
            npm run build
            <br />
            npm run serve:lan -- --host 0.0.0.0
          </code>
          <p className="wb-muted">{t('team_storage_hint')}</p>
        </section>
      ) : (
        <>
          <div className="team-toolbar">
            <label className="wb-field">
              <span className="wb-sr-only">{t('team_select_project')}</span>
              <select
                aria-label={t('team_select_project')}
                className="workbench-select"
                value={actions.project?.id ?? ''}
                disabled={actions.busy}
                onChange={(event) => {
                  setCreating(false);
                  void actions.select(event.target.value);
                }}
              >
                <option value="" disabled>
                  {t('team_select_project')}
                </option>
                {actions.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
            {['admin', 'editor'].includes(actions.member.role) && (
              <button
                className="workbench-btn wb-primary"
                disabled={actions.busy}
                onClick={() => setCreating(true)}
              >
                {t('team_new_project')}
              </button>
            )}
            <span className="wb-muted">
              {actions.member.name} · {t(`team_role_${actions.member.role}`)}
            </span>
            <button className="workbench-btn" disabled={actions.busy} onClick={actions.logout}>
              {t('team_logout')}
            </button>
          </div>
          <TeamMembers actions={actions} />
          {creating ? (
            <ProjectForm actions={actions} close={() => setCreating(false)} />
          ) : actions.project ? (
            <ProjectBoard key={actions.project.id} actions={actions} />
          ) : (
            <div className="team-empty">
              <h2>{t('team_choose_or_create')}</h2>
              <p className="wb-muted">{t('team_shared_hint')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
