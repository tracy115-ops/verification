import { useState } from 'react';
import type { RequirementArtifact, ScenarioJourney } from '../../domain/runtime/types';
import { useI18n } from '../../shared/i18n/context';
import type { MessageKey } from '../../shared/i18n/messages';

type Step = ScenarioJourney['steps'][number];
const emptyStep = (id: string): Step => ({
  id,
  fromState: '',
  action: '',
  toState: '',
  observation: '',
  requirementId: '',
  sourceQuote: '',
});
export function JourneyEditor({
  value,
  change,
  requirements,
}: {
  value?: ScenarioJourney;
  change: (value: ScenarioJourney | undefined) => void;
  requirements: RequirementArtifact['requirements'];
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(0);
  const [preconditions, setPreconditions] = useState(value?.preconditions.join('\n') ?? '');
  const index = Math.min(selected, (value?.steps.length ?? 1) - 1);
  const step = value?.steps[index];
  function updateStep(next: Step) {
    if (value) change({ ...value, steps: value.steps.map((old, i) => (i === index ? next : old)) });
  }
  return (
    <fieldset className="journey-editor">
      <legend>{t('journeyTitle')}</legend>
      <label className="collab-check">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(event) => {
            setSelected(0);
            setPreconditions('');
            change(
              event.target.checked
                ? {
                    version: 1,
                    initialState: '',
                    preconditions: [],
                    steps: [emptyStep('T1'), emptyStep('T2')],
                  }
                : undefined,
            );
          }}
        />
        {t('journeyEnable')}
      </label>
      <p className="wb-muted">{t('journeyHint')}</p>
      {value && step && (
        <>
          <label className="wb-field">
            {t('journeyInitialState')}
            <input
              className="workbench-input"
              required
              maxLength={160}
              value={value.initialState}
              onChange={(event) => change({ ...value, initialState: event.target.value })}
            />
          </label>
          <label className="wb-field">
            {t('journeyPreconditions')}
            <textarea
              className="workbench-textarea"
              maxLength={12000}
              value={preconditions}
              onChange={(event) => {
                setPreconditions(event.target.value);
                change({
                  ...value,
                  preconditions: event.target.value
                    .split('\n')
                    .map((item) => item.trim())
                    .filter(Boolean),
                });
              }}
            />
          </label>
          <nav className="journey-step-tabs" aria-label={t('journeySteps')}>
            {value.steps.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className="workbench-btn"
                aria-current={index === i ? 'step' : undefined}
                onClick={() => setSelected(i)}
              >
                {item.id}
              </button>
            ))}
          </nav>
          <JourneyStepFields value={step} change={updateStep} requirements={requirements} />
          <div className="modal-actions">
            <button
              className="workbench-btn"
              type="button"
              disabled={value.steps.length >= 12}
              onClick={() => {
                const id = `T_${crypto.randomUUID().slice(0, 8)}`;
                change({
                  ...value,
                  steps: [...value.steps, { ...emptyStep(id), fromState: value.steps.at(-1)!.toState }],
                });
                setSelected(value.steps.length);
              }}
            >
              {t('journeyAddStep')}
            </button>
            <button
              className="workbench-btn"
              type="button"
              disabled={value.steps.length <= 2}
              onClick={() => change({ ...value, steps: value.steps.filter((_, i) => i !== index) })}
            >
              {t('journeyRemoveStep')}
            </button>
          </div>
        </>
      )}
    </fieldset>
  );
}

function JourneyStepFields({
  value,
  change,
  requirements,
}: {
  value: Step;
  change: (value: Step) => void;
  requirements: RequirementArtifact['requirements'];
}) {
  const { t } = useI18n();
  const fields: { key: 'fromState' | 'toState' | 'action' | 'observation'; label: MessageKey }[] = [
    { key: 'fromState', label: 'journeyFrom' },
    { key: 'toState', label: 'journeyTo' },
    { key: 'action', label: 'journeyAction' },
    { key: 'observation', label: 'journeyObservation' },
  ];
  return (
    <div className="journey-step-fields">
      <code>{value.id}</code>
      {fields.map(({ key, label }) => (
        <label className="wb-field" key={key}>
          {t(label)}
          {key === 'fromState' || key === 'toState' ? (
            <input
              className="workbench-input"
              required
              maxLength={160}
              value={value[key]}
              onChange={(event) => change({ ...value, [key]: event.target.value })}
            />
          ) : (
            <textarea
              className="workbench-textarea"
              required
              maxLength={12000}
              value={value[key]}
              onChange={(event) => change({ ...value, [key]: event.target.value })}
            />
          )}
        </label>
      ))}
      <label className="wb-field">
        {t('journeyRule')}
        <select
          className="workbench-select"
          required
          value={value.requirementId}
          onChange={(event) => {
            const requirement = requirements.find((item) => item.id === event.target.value);
            change({ ...value, requirementId: event.target.value, sourceQuote: requirement?.quote ?? '' });
          }}
        >
          <option value="">{t('journeySelectRule')}</option>
          {requirements.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id} · {item.text}
            </option>
          ))}
        </select>
      </label>
      <label className="wb-field">
        {t('designQuote')}
        <textarea
          className="workbench-textarea"
          required
          maxLength={12000}
          value={value.sourceQuote}
          onChange={(event) => change({ ...value, sourceQuote: event.target.value })}
        />
      </label>
    </div>
  );
}
