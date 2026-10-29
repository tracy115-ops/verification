import { useState } from 'react';
import { Plus } from 'lucide-react';
import { newId } from '../../shared/id';
import type { TeamActions } from './useTeam';
import { useI18n } from '../../shared/i18n/context';
import { ReviewDialog } from '../sessions/ReviewDialog';
import { InlineTeamError } from './InlineTeamError';

export function ScenarioCreate({
  actions,
  created,
  disabled = false,
}: {
  actions: TeamActions;
  created: (id: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [open, setOpen] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const id = `SC_${newId()}`;
    if (await actions.command({ type: 'add_scenario', id, title, interfaceIds: target ? [target] : [] })) {
      setTitle('');
      setOpen(false);
      created(id);
    }
  }
  return (
    <>
      <button
        className="workbench-btn"
        aria-label={t('team_add_scenario')}
        title={t('team_add_scenario')}
        disabled={actions.busy || disabled}
        onClick={() => setOpen(true)}
      >
        <Plus size={16} />
      </button>
      <ReviewDialog
        open={open}
        close={() => setOpen(false)}
        title="team_add_scenario"
        closeLabel="team_close"
      >
        <form className="team-scenario-create" onSubmit={(event) => void submit(event)}>
          <InlineTeamError code={actions.error} />
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
              aria-label={t('team_interface_name')}
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
      </ReviewDialog>
    </>
  );
}
