import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { useTeam } from './useTeam';
import { useI18n, isMessageKey } from '../../shared/i18n/context';
import { ProjectForm } from './ProjectForm';
import { ProjectBoard } from './ProjectBoard';
import { TeamMembers } from './TeamMembers';
import { TeamLogin } from './TeamLogin';
import { ProjectPicker } from './ProjectPicker';
import { ReviewDialog } from '../sessions/ReviewDialog';

export function TeamWorkspace({
  serverUrl = '',
  leaveServer,
}: {
  serverUrl?: string;
  leaveServer?: () => void;
}) {
  const actions = useTeam(serverUrl);
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  const [members, setMembers] = useState(false);
  const [account, setAccount] = useState(false);
  const [locked, setLocked] = useState(false);
  function changeServer() {
    actions.logout();
    leaveServer?.();
  }
  return (
    <div className="team-workspace">
      {actions.error && (
        <div className="wb-error team-error" role="alert">
          {isMessageKey(actions.error) ? t(actions.error) : t('team_server_error')}
        </div>
      )}
      {!actions.member ? (
        <TeamLogin actions={actions} serverUrl={serverUrl} changeServer={changeServer} />
      ) : (
        <>
          <header className="team-project-header">
            {actions.project && (
              <div className="team-project-heading">
                <h1>{actions.project.title}</h1>
                <small className="wb-muted">
                  {actions.project
                    ? `${t(actions.project.mode === 'black_box' ? 'team_black_box' : 'team_collaborative')} · r${actions.project.revision} · ${t('teamSyncHint')}`
                    : t('teamConnectProject')}
                </small>
              </div>
            )}
            <span className="team-current-member">
              {actions.member.name} · {t(`team_role_${actions.member.role}`)}
            </span>
            <button className="workbench-btn" onClick={() => setMembers(true)}>
              {t('team_members')}
            </button>
            {actions.project && (
              <button
                className="workbench-btn"
                disabled={actions.busy || locked}
                title={locked ? t('team_unsaved') : undefined}
                onClick={actions.clearProject}
              >
                {t('teamChangeProject')}
              </button>
            )}
            <button
              className="workbench-btn wb-text"
              aria-label={t('teamConnectionSettings')}
              title={t('teamConnectionSettings')}
              onClick={() => setAccount(true)}
            >
              <Settings2 size={18} />
            </button>
          </header>
          {actions.project ? (
            <ProjectBoard key={actions.project.id} actions={actions} onDirty={setLocked} />
          ) : (
            <ProjectPicker actions={actions} create={() => setCreating(true)} />
          )}
        </>
      )}
      <ReviewDialog
        open={creating}
        close={() => setCreating(false)}
        title="team_new_project"
        closeLabel="team_close"
      >
        {creating && <ProjectForm actions={actions} close={() => setCreating(false)} />}
      </ReviewDialog>
      <ReviewDialog
        open={members}
        close={() => setMembers(false)}
        title="team_members"
        closeLabel="team_close"
      >
        {members && <TeamMembers actions={actions} expanded />}
      </ReviewDialog>
      <ReviewDialog
        open={account}
        close={() => setAccount(false)}
        title="teamConnectionSettings"
        closeLabel="team_close"
      >
        <div className="collab-form">
          <label className="wb-field">
            {t('desktopTeamServer')}
            <code>{serverUrl || location.origin}</code>
          </label>
          {actions.member && (
            <p>
              {actions.member.name} · {t(`team_role_${actions.member.role}`)}
            </p>
          )}
          {locked && <p className="wb-muted">{t('team_unsaved')}</p>}
          <div className="team-actions">
            <button
              className="workbench-btn"
              disabled={actions.busy || locked}
              onClick={() => {
                actions.logout();
                setAccount(false);
              }}
            >
              {t('team_logout')}
            </button>
            {serverUrl && (
              <button
                className="workbench-btn"
                disabled={actions.busy || locked}
                onClick={() => {
                  changeServer();
                  setAccount(false);
                }}
              >
                {t('desktopTeamChange')}
              </button>
            )}
          </div>
        </div>
      </ReviewDialog>
    </div>
  );
}
