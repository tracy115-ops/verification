import { useState } from 'react';
import type { TeamActions } from './useTeam';
import type { TeamRole } from '../../domain/team/types';
import { useI18n } from '../../shared/i18n/context';

export function TeamMembers({ actions }: { actions: TeamActions }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [role, setRole] = useState<TeamRole>('editor');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const member = await actions.api.addMember(name, role);
      setToken(member.token);
      setName('');
      actions.setMembers(await actions.api.members());
    } catch (error) {
      actions.setError(error instanceof Error ? error.message : 'team_server_error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="team-members">
      <summary>{t('team_members')}</summary>
      <ul>
        {actions.members.map((member) => (
          <li key={member.id}>
            {member.name} · {t(`team_role_${member.role}`)}
          </li>
        ))}
      </ul>
      {actions.member?.role === 'admin' && (
        <form onSubmit={(event) => void add(event)}>
          <label className="wb-field">
            {t('team_member_name')}
            <input
              className="workbench-input"
              value={name}
              required
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="wb-field">
            {t('team_member_role')}
            <select
              className="workbench-select"
              value={role}
              onChange={(event) => setRole(event.target.value as TeamRole)}
            >
              {(['editor', 'reviewer', 'viewer', 'admin'] as const).map((role) => (
                <option value={role} key={role}>
                  {t(`team_role_${role}`)}
                </option>
              ))}
            </select>
          </label>
          <button className="workbench-btn" disabled={busy} type="submit">
            {t('team_add_member')}
          </button>
          {token && (
            <label className="wb-field">
              {t('team_invite_token')}
              <input className="workbench-input wb-code" readOnly value={token} />
            </label>
          )}
        </form>
      )}
    </details>
  );
}
