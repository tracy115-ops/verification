import { useState } from 'react';
import type { TeamActions } from './useTeam';
import { useI18n } from '../../shared/i18n/context';

export function ProjectForm({ actions, close }: { actions: TeamActions; close: () => void }) {
  const { t, locale } = useI18n();
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<'black_box' | 'collaborative'>('black_box');
  const [interfaces, setInterfaces] = useState([{ id: 'IF_1', name: '', contract: '' }]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      await actions.create({
        title,
        topic,
        mode,
        locale,
        interfaces: interfaces.filter((item) => item.name.trim()),
      })
    )
      close();
  }
  return (
    <form className="team-project-form" onSubmit={(event) => void submit(event)}>
      <div className="team-form-row">
        <label className="wb-field">
          {t('team_project_title')}
          <input
            className="workbench-input"
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="wb-field">
          {t('team_mode')}
          <select
            className="workbench-select"
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
          >
            <option value="black_box">{t('team_black_box')}</option>
            <option value="collaborative">{t('team_collaborative')}</option>
          </select>
        </label>
      </div>
      <label className="wb-field">
        {t('team_topic')}
        <textarea
          className="workbench-textarea"
          required
          maxLength={40000}
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
        />
      </label>
      <p className="wb-muted">{t('team_contract_hint')}</p>
      {interfaces.map((item, index) => (
        <fieldset key={item.id}>
          <legend>{item.id}</legend>
          <label className="wb-field">
            {t('team_interface_name')}
            <input
              className="workbench-input"
              maxLength={200}
              value={item.name}
              onChange={(event) =>
                setInterfaces((items) =>
                  items.map((value, position) =>
                    position === index ? { ...value, name: event.target.value } : value,
                  ),
                )
              }
            />
          </label>
          <label className="wb-field">
            {t('team_interface_contract')}
            <textarea
              className="workbench-textarea"
              maxLength={12000}
              value={item.contract}
              onChange={(event) =>
                setInterfaces((items) =>
                  items.map((value, position) =>
                    position === index ? { ...value, contract: event.target.value } : value,
                  ),
                )
              }
            />
          </label>
        </fieldset>
      ))}
      <div className="team-actions">
        <button
          type="button"
          className="workbench-btn"
          disabled={interfaces.length >= 20}
          onClick={() =>
            setInterfaces((items) => [...items, { id: `IF_${items.length + 1}`, name: '', contract: '' }])
          }
        >
          {t('team_add_interface')}
        </button>
        <button type="button" className="workbench-btn" onClick={close}>
          {t('team_close')}
        </button>
        <button className="workbench-btn wb-primary" disabled={actions.busy} type="submit">
          {t('team_create')}
        </button>
      </div>
    </form>
  );
}
