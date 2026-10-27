import type { TeamActions } from './useTeam';
import type { TeamScenario } from '../../domain/team/types';
import { useI18n } from '../../shared/i18n/context';

export type ScenarioDraft = Pick<
  TeamScenario,
  'title' | 'oracle' | 'oracleBasis' | 'sourceQuote' | 'factorValues' | 'ownerId'
>;
export interface DraftFields {
  actions: TeamActions;
  draft: ScenarioDraft;
  change: (patch: Partial<ScenarioDraft>) => void;
  editable: boolean;
}
export function ScenarioFields({ actions, draft, change, editable }: DraftFields) {
  const { t } = useI18n();
  return (
    <>
      <label className="wb-field">
        {t('team_scenario_title')}
        <input
          className="workbench-input"
          value={draft.title}
          maxLength={12000}
          disabled={!editable}
          onChange={(event) => change({ title: event.target.value })}
        />
      </label>
      <label className="wb-field">
        {t('team_owner')}
        <select
          className="workbench-select"
          disabled={!editable}
          value={draft.ownerId}
          onChange={(event) => change({ ownerId: event.target.value })}
        >
          <option value="">{t('team_unassigned')}</option>
          {actions.members
            .filter((item) => ['admin', 'editor'].includes(item.role))
            .map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
        </select>
      </label>
      <label className="wb-field">
        {t('team_oracle')}
        <textarea
          className="workbench-textarea"
          maxLength={12000}
          value={draft.oracle}
          disabled={!editable}
          onChange={(event) => change({ oracle: event.target.value })}
        />
      </label>
      <label className="wb-field">
        {t('team_oracle_basis')}
        <select
          className="workbench-select"
          disabled={!editable}
          value={draft.oracleBasis}
          onChange={(event) => change({ oracleBasis: event.target.value as TeamScenario['oracleBasis'] })}
        >
          {(['unknown', 'contract', 'approved_assumption'] as const).map((value) => (
            <option value={value} key={value}>
              {t(`team_basis_${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="wb-field">
        {t('sourceQuote')}
        <textarea
          className="workbench-textarea"
          maxLength={12000}
          value={draft.sourceQuote}
          disabled={!editable}
          onChange={(event) => change({ sourceQuote: event.target.value })}
        />
      </label>
    </>
  );
}
export function FactorValues({ actions, draft, change, editable }: DraftFields) {
  const { t } = useI18n();
  const project = actions.project!;
  return (
    <fieldset>
      <legend>{t('team_factor_values')}</legend>
      {draft.factorValues.map((value, index) => (
        <div className="team-factor-value" key={index}>
          <select
            aria-label={`${t('team_factor')} ${index + 1}`}
            className="workbench-select"
            disabled={!editable}
            value={value.factorId}
            onChange={(event) => {
              const factor = project.factors.find((item) => item.id === event.target.value)!;
              change({
                factorValues: draft.factorValues.map((value, at) =>
                  at === index ? { factorId: factor.id, level: factor.levels[0] } : value,
                ),
              });
            }}
          >
            <option value="" disabled>
              {t('team_factor')}
            </option>
            {project.factors.map((factor) => (
              <option key={factor.id} value={factor.id}>
                {factor.name}
              </option>
            ))}
          </select>
          <select
            aria-label={`${t('team_level')} ${index + 1}`}
            className="workbench-select"
            disabled={!editable}
            value={value.level}
            onChange={(event) =>
              change({
                factorValues: draft.factorValues.map((value, at) =>
                  at === index ? { ...value, level: event.target.value } : value,
                ),
              })
            }
          >
            {project.factors
              .find((item) => item.id === value.factorId)
              ?.levels.map((level) => (
                <option key={level}>{level}</option>
              ))}
          </select>
          {editable && (
            <button
              className="workbench-btn"
              onClick={() => change({ factorValues: draft.factorValues.filter((_, at) => at !== index) })}
            >
              {t('team_remove')}
            </button>
          )}
        </div>
      ))}
      {editable && (
        <button
          className="workbench-btn"
          disabled={draft.factorValues.length >= 30 || draft.factorValues.length >= project.factors.length}
          onClick={() => {
            const factor = project.factors.find(
              (factor) => !draft.factorValues.some((item) => item.factorId === factor.id),
            );
            if (factor)
              change({
                factorValues: [...draft.factorValues, { factorId: factor.id, level: factor.levels[0] }],
              });
          }}
        >
          {t('team_add_factor_value')}
        </button>
      )}
    </fieldset>
  );
}
