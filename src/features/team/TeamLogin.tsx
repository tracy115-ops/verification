import { useState } from 'react';
import { Users } from 'lucide-react';
import type { TeamActions } from './useTeam';
import { useI18n } from '../../shared/i18n/context';
import { ConnectionSteps } from './ConnectionSteps';

export function TeamLogin({
  actions,
  serverUrl,
  changeServer,
}: {
  actions: TeamActions;
  serverUrl: string;
  changeServer?: () => void;
}) {
  const { t } = useI18n();
  const [token, setToken] = useState('');
  return (
    <>
      <ConnectionSteps
        step={2}
        back={serverUrl && !actions.authenticating ? () => changeServer?.() : undefined}
      />
      <section className="team-login">
        <span className="wb-icon-tile">
          <Users size={24} />
        </span>
        <h1>{t('teamConnectIdentity')}</h1>
        {serverUrl && (
          <div className="team-login-address">
            <code>{serverUrl}</code>
            <button
              className="workbench-btn wb-text"
              disabled={actions.authenticating}
              onClick={changeServer}
            >
              {t('desktopTeamChange')}
            </button>
          </div>
        )}
        <p>{t(serverUrl ? 'desktopTeamLoginHint' : 'team_join_hint')}</p>
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
          <button className="workbench-btn wb-primary" type="submit" disabled={actions.authenticating}>
            {t(actions.authenticating ? 'desktopTeamLoggingIn' : 'team_login')}
          </button>
        </form>
        {!serverUrl && (
          <details>
            <summary>{t('team_start_hint')}</summary>
            <code>
              npm run build
              <br />
              npm run serve:lan -- --host 0.0.0.0
            </code>
            <p className="wb-muted">{t('team_storage_hint')}</p>
          </details>
        )}
      </section>
    </>
  );
}
