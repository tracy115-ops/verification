import { useState } from 'react';
import type { CaseDefinition, SharedCase } from '../../domain/team/collaboration';
import { useI18n } from '../../shared/i18n/context';
import { ReviewDialog } from '../sessions/ReviewDialog';
import { newId } from '../../shared/id';
import type { TeamActions } from './useTeam';
import { InlineTeamError } from './InlineTeamError';

export function CaseEditor({
  actions,
  item,
  close,
}: {
  actions: TeamActions;
  item?: SharedCase;
  close: () => void;
}) {
  const { t } = useI18n();
  const project = actions.project!;
  const [revision] = useState(project.revision);
  const [draft, setDraft] = useState<CaseDefinition>(() =>
    item
      ? {
          id: item.id,
          title: item.title,
          scenarioIds: [...item.scenarioIds],
          preconditions: [...item.preconditions],
          steps: [...item.steps],
          expected: item.expected,
          assertions: [...item.assertions],
          ownerId: item.ownerId,
        }
      : {
          id: `TC_${newId()}`,
          title: '',
          scenarioIds: [],
          preconditions: [],
          steps: [],
          expected: '',
          assertions: [],
          ownerId: actions.member?.id ?? '',
        },
  );
  const lines = (value: string) => value.split('\n');
  async function save() {
    const value = {
      ...draft,
      preconditions: draft.preconditions.filter((line) => line.trim()),
      steps: draft.steps.filter((line) => line.trim()),
      assertions: draft.assertions.filter((line) => line.trim()),
    };
    if (await actions.command({ type: 'upsert_case', value, caseRevision: item?.revision ?? 0 }, revision))
      close();
  }
  return (
    <ReviewDialog open close={close} title={item ? 'collab_edit_case' : 'collab_new_case'}>
      <form
        className="collab-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <InlineTeamError code={actions.error} />
        {project.revision !== revision && <p className="wb-banner">{t('team_conflict_draft')}</p>}
        <label className="wb-field">
          {t('collab_case_title')}
          <input
            aria-label={t('collab_case_title')}
            className="workbench-input"
            value={draft.title}
            maxLength={12000}
            required
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </label>
        <fieldset>
          <legend>{t('collab_case_scenarios')}</legend>
          <div className="collab-options">
            {project.scenarios.map((scenario) => (
              <label key={scenario.id}>
                <input
                  type="checkbox"
                  checked={draft.scenarioIds.includes(scenario.id)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      scenarioIds: event.target.checked
                        ? [...draft.scenarioIds, scenario.id]
                        : draft.scenarioIds.filter((id) => id !== scenario.id),
                    })
                  }
                />
                {scenario.id} · {scenario.title}
              </label>
            ))}
          </div>
        </fieldset>
        {(['preconditions', 'steps', 'assertions'] as const).map((key) => (
          <label className="wb-field" key={key}>
            {t(
              key === 'preconditions'
                ? 'collab_preconditions'
                : key === 'steps'
                  ? 'collab_steps'
                  : 'collab_assertions',
            )}
            <textarea
              aria-label={t(
                key === 'preconditions'
                  ? 'collab_preconditions'
                  : key === 'steps'
                    ? 'collab_steps'
                    : 'collab_assertions',
              )}
              className="workbench-textarea"
              value={draft[key].join('\n')}
              maxLength={30000}
              onChange={(event) => setDraft({ ...draft, [key]: lines(event.target.value) })}
            />
          </label>
        ))}
        <label className="wb-field">
          {t('collab_expected')}
          <textarea
            aria-label={t('collab_expected')}
            className="workbench-textarea"
            value={draft.expected}
            maxLength={12000}
            onChange={(event) => setDraft({ ...draft, expected: event.target.value })}
          />
        </label>
        <label className="wb-field">
          {t('team_owner')}
          <select
            aria-label={t('team_owner')}
            className="workbench-select"
            value={draft.ownerId}
            onChange={(event) => setDraft({ ...draft, ownerId: event.target.value })}
          >
            <option value="">{t('team_unassigned')}</option>
            {actions.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="workbench-btn wb-primary"
          disabled={actions.busy || !draft.title.trim() || !draft.scenarioIds.length}
        >
          {t('collab_save_case')}
        </button>
      </form>
    </ReviewDialog>
  );
}
