import { useState } from 'react';
import type { Conversations } from '../../app/useConversations';
import type { Artifact, CaseArtifact, DesignArtifact, WorkflowRun } from '../../domain/runtime/types';
import { scopedCases } from '../../domain/runtime/case-scope';
import { isCases, isDesign } from '../../domain/runtime/artifacts';
import { useI18n } from '../../shared/i18n/context';
import { ArtifactPanel } from './ArtifactPanel';

export function ReviewArtifactPreview({
  run,
  artifact,
  inputs,
  actions,
  close,
}: {
  run: WorkflowRun;
  artifact: Artifact;
  inputs: Artifact[];
  actions: Conversations;
  close: () => void;
}) {
  const design = inputs.find((item) => item.type === 'TestDesign')?.value;
  if (!isCases(artifact.value) || !isDesign(design)) return <ArtifactPanel artifact={artifact} />;
  return (
    <CaseScenarioReview run={run} draft={artifact.value} design={design} actions={actions} close={close} />
  );
}

function CaseScenarioReview({
  run,
  draft,
  design,
  actions,
  close,
}: {
  run: WorkflowRun;
  draft: CaseArtifact;
  design: DesignArtifact;
  actions: Conversations;
  close: () => void;
}) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState('');
  const [failed, setFailed] = useState(false);
  const cases = scopedCases(run, draft).cases;
  const linked = new Set(cases.flatMap((item) => item.scenarioIds));
  const scenario =
    design.scenarios.find((item) => item.id === selected) ??
    design.scenarios.find((item) => !linked.has(item.id)) ??
    design.scenarios[0];
  const visible = cases.filter((item) => item.scenarioIds.includes(scenario.id));
  const number = new Intl.NumberFormat(locale);
  function prepare() {
    const instruction = t('caseScenarioRepairPrompt').replace('{id}', scenario.id);
    if (!actions.prepareCaseRepair(run, instruction)) {
      setFailed(true);
      return;
    }
    actions.setSelectedRunId(run.id);
    close();
  }
  return (
    <section className="session-case-scenario-review" aria-label={t('caseScenarioReview')}>
      <p className="wb-muted">
        {t('qualityScenarios')} ·{' '}
        {number.format(design.scenarios.filter((item) => linked.has(item.id)).length)}
        {' / '}
        {number.format(design.scenarios.length)}
      </p>
      <label className="wb-field">
        {t('caseScenarioReview')}
        <select
          className="workbench-select"
          value={scenario.id}
          onChange={(event) => {
            setSelected(event.target.value);
            setFailed(false);
          }}
        >
          {design.scenarios.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id} · {item.title}
              {linked.has(item.id) ? '' : ` · ${t('qualityScenario')}`}
            </option>
          ))}
        </select>
      </label>
      <div className="wb-banner">
        <strong>{t('caseScenarioExpected')}</strong>
        <p>{scenario.expected}</p>
        <small>
          {t('relatedRequirements')} · {scenario.requirementIds.join(', ')}
        </small>
      </div>
      <p className="wb-muted">{t('caseScenarioReviewHint')}</p>
      {visible.length ? (
        <div className="session-artifact">
          {visible.map((item) => (
            <article key={item.id}>
              <h4>
                <code>{item.id}</code> · {item.title}
              </h4>
              <small>{t('assertions')}</small>
              <ul>
                {item.assertions.map((assertion, index) => (
                  <li key={index}>{assertion}</li>
                ))}
              </ul>
              <details>
                <summary>{t('caseSteps')}</summary>
                {!!item.preconditions.length && (
                  <>
                    <small>{t('casePreconditions')}</small>
                    <ul>
                      {item.preconditions.map((precondition, index) => (
                        <li key={index}>{precondition}</li>
                      ))}
                    </ul>
                  </>
                )}
                <ol>
                  {item.steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
                <p>{item.expected}</p>
              </details>
            </article>
          ))}
        </div>
      ) : (
        <p>{t('qualityScenario')}</p>
      )}
      <button
        type="button"
        className="workbench-btn"
        disabled={actions.isSessionBusy(run.sessionId)}
        onClick={prepare}
      >
        {t('caseScenarioRepair')}
      </button>
      {failed && (
        <p role="alert" className="wb-error">
          {t('qualityRepairFailed')}
        </p>
      )}
    </section>
  );
}
