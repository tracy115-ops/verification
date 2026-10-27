import { useState } from 'react';
import { newId } from '../../shared/id';
import type { TeamActions } from './useTeam';
import { useI18n } from '../../shared/i18n/context';

export function ScenarioCreate({
  actions,
  created,
}: {
  actions: TeamActions;
  created: (id: string) => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const id = `SC_${newId()}`;
    if (await actions.command({ type: 'add_scenario', id, title, interfaceIds: target ? [target] : [] })) {
      setTitle('');
      created(id);
    }
  }
  return (
    <details className="team-scenario-create">
      <summary>{t('team_add_scenario')}</summary>
      <form onSubmit={(event) => void submit(event)}>
        <label className="wb-field">
          {t('team_scenario_title')}
          <input
            className="workbench-input"
            required
            maxLength={12000}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="wb-field">
          {t('team_interface_name')}
          <select
            className="workbench-select"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            <option value="">{t('team_unassigned')}</option>
            {actions.project!.interfaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button className="workbench-btn" disabled={actions.busy} type="submit">
          {t('team_add_scenario')}
        </button>
      </form>
    </details>
  );
}
