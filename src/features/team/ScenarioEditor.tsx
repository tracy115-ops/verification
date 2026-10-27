import { useEffect, useState } from 'react';
import type { TeamActions } from './useTeam';
import type { TeamScenario } from '../../domain/team/types';
import { useI18n } from '../../shared/i18n/context';
import { ScenarioFields, FactorValues, type ScenarioDraft } from './ScenarioFields';
import { ScenarioReview } from './ScenarioReview';

function initialDraft(scenario: TeamScenario): ScenarioDraft {
  return {
    title: scenario.title,
    oracle: scenario.oracle,
    oracleBasis: scenario.oracleBasis,
    sourceQuote: scenario.sourceQuote,
    factorValues: structuredClone(scenario.factorValues),
    ownerId: scenario.ownerId,
  };
}
export function ScenarioEditor({
  actions,
  scenario,
  onDirty,
}: {
  actions: TeamActions;
  scenario: TeamScenario;
  onDirty: (dirty: boolean) => void;
}) {
  const { t } = useI18n();
  const project = actions.project!;
  const [draft, setDraft] = useState(() => initialDraft(scenario));
  const [dirty, setDirty] = useState(false);
  const [baseRevision, setBaseRevision] = useState(project.revision);
  const editable = ['admin', 'editor'].includes(actions.member?.role ?? '');
  useEffect(() => {
    if (!dirty) {
      setDraft(initialDraft(scenario));
      setBaseRevision(project.revision);
    }
  }, [project.revision, scenario, dirty]);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function change(patch: Partial<typeof draft>) {
    setDraft((value) => ({ ...value, ...patch }));
    setDirty(true);
  }
  async function save() {
    if (await actions.command({ type: 'edit_scenario', scenarioId: scenario.id, ...draft }, baseRevision))
      setDirty(false);
  }
  return (
    <section className="team-scenario-editor" aria-label={t('team_scenario_details')}>
      <header>
        <code>{scenario.id}</code>
        <h2>{scenario.title}</h2>
      </header>
      {dirty && (
        <div className="wb-banner">
          {t(baseRevision !== project.revision ? 'team_conflict_draft' : 'team_unsaved')}
        </div>
      )}
      <ScenarioFields actions={actions} draft={draft} change={change} editable={editable && !actions.busy} />
      <FactorValues actions={actions} draft={draft} change={change} editable={editable && !actions.busy} />
      {editable && (
        <div className="team-actions">
          <button className="workbench-btn" disabled={!dirty || actions.busy} onClick={() => setDirty(false)}>
            {t('team_discard_draft')}
          </button>
          <button
            className="workbench-btn wb-primary"
            disabled={!dirty || actions.busy}
            onClick={() => void save()}
          >
            {t('team_save_scenario')}
          </button>
        </div>
      )}
      <ScenarioReview actions={actions} scenario={scenario} dirty={dirty} />
    </section>
  );
}
