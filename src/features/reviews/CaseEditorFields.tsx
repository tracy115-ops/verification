import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DesignArtifact, RequirementArtifact } from '../../domain/runtime/types';
import type { CaseFormValue } from './case-editor-types';
import { useI18n } from '../../shared/i18n/context';

interface Props {
  value: CaseFormValue;
  change: Dispatch<SetStateAction<CaseFormValue>>;
}
export function CaseLinks({
  value,
  change,
  design,
  requirements,
}: Props & { design: DesignArtifact; requirements: RequirementArtifact }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const eligible = new Set(
    design.scenarios
      .filter((item) => value.scenarioIds.includes(item.id))
      .flatMap((item) => item.requirementIds),
  );
  return (
    <>
      <label className="wb-field">
        ID
        <input
          required
          className="workbench-input"
          pattern="[A-Za-z][A-Za-z0-9_-]{0,79}"
          maxLength={80}
          disabled={value.target.mode === 'edit'}
          value={value.id}
          onChange={(event) => change((current) => ({ ...current, id: event.target.value }))}
        />
      </label>
      <label className="wb-field">
        {t('caseName')}
        <input
          required
          className="workbench-input"
          maxLength={12000}
          value={value.title}
          onChange={(event) => change((current) => ({ ...current, title: event.target.value }))}
        />
      </label>
      <fieldset>
        <legend>{t('caseScenarioLinks')}</legend>
        <input
          className="workbench-input"
          aria-label={t('caseScenarioSearch')}
          placeholder={t('caseScenarioSearch')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="case-editor-options">
          {design.scenarios
            .filter((item) =>
              `${item.id} ${item.title}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
            )
            .map((item) => (
              <label key={item.id} className="collab-check">
                <input
                  type="checkbox"
                  checked={value.scenarioIds.includes(item.id)}
                  onChange={(event) =>
                    change((current) => {
                      const scenarioIds = event.target.checked
                        ? [...current.scenarioIds, item.id]
                        : current.scenarioIds.filter((id) => id !== item.id);
                      const available = new Set(
                        design.scenarios
                          .filter((item) => scenarioIds.includes(item.id))
                          .flatMap((item) => item.requirementIds),
                      );
                      return {
                        ...current,
                        scenarioIds,
                        requirementIds: event.target.checked
                          ? [...new Set([...current.requirementIds, ...item.requirementIds])]
                          : current.requirementIds.filter((id) => available.has(id)),
                      };
                    })
                  }
                />
                <span>
                  {item.id} · {item.title}
                </span>
              </label>
            ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>{t('designRequirements')}</legend>
        <div className="case-editor-options">
          {requirements.requirements
            .filter((item) => eligible.has(item.id))
            .map((item) => (
              <label key={item.id} className="collab-check">
                <input
                  type="checkbox"
                  checked={value.requirementIds.includes(item.id)}
                  onChange={(event) =>
                    change((current) => ({
                      ...current,
                      requirementIds: event.target.checked
                        ? [...current.requirementIds, item.id]
                        : current.requirementIds.filter((id) => id !== item.id),
                    }))
                  }
                />
                <span>
                  {item.id} · {item.text}
                </span>
              </label>
            ))}
        </div>
      </fieldset>
    </>
  );
}
export function CaseDetails({ value, change }: Props) {
  const { t } = useI18n();
  const fields = {
    preconditions: 'caseEditPreconditions',
    steps: 'caseEditSteps',
    expected: 'caseEditExpected',
    assertions: 'caseAssertions',
  } as const;
  return (
    <>
      {(Object.keys(fields) as (keyof typeof fields)[]).map((key) => (
        <label key={key} className="wb-field">
          {t(fields[key])}
          <textarea
            aria-label={t(fields[key])}
            className="workbench-textarea"
            required={key !== 'preconditions'}
            maxLength={12000}
            value={value[key]}
            onChange={(event) => change((current) => ({ ...current, [key]: event.target.value }))}
          />
        </label>
      ))}
    </>
  );
}
