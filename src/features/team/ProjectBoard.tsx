import { useEffect, useState } from 'react';
import { useI18n } from '../../shared/i18n/context';
import { collaboration } from '../../domain/team/collaboration';
import type { TeamActions } from './useTeam';
import { ScenarioBoard } from './ScenarioBoard';
import { ContributionBoard } from './ContributionBoard';
import { CaseBoard } from './CaseBoard';
import { FactorList } from './FactorList';
import { TeamSources } from './TeamSources';

type Step = 'sources' | 'factors' | 'scenarios' | 'cases' | 'proposals';
const steps = [
  { id: 'sources', key: 'teamStepSource' },
  { id: 'factors', key: 'team_factors' },
  { id: 'scenarios', key: 'teamScenarioStep' },
  { id: 'cases', key: 'collab_cases' },
  { id: 'proposals', key: 'collab_proposals' },
] as const;

export function ProjectBoard({
  actions,
  onDirty,
}: {
  actions: TeamActions;
  onDirty: (dirty: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const [step, setStep] = useState<Step>(actions.project!.scenarios.length ? 'scenarios' : 'sources');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  const state = collaboration(actions.project!);
  const counts = {
    sources: '',
    factors: actions.project!.factors.length,
    scenarios: actions.project!.scenarios.length,
    cases: state.cases.length,
    proposals: state.contributions
      .flatMap((proposal) => proposal.items)
      .filter((item) => item.status === 'pending').length,
  };
  return (
    <div className="collab-project">
      <nav className="team-content-steps" aria-label={t('teamContentSteps')}>
        {steps.map((item, index) => (
          <button
            key={item.id}
            className="workbench-btn"
            aria-label={t(item.key)}
            aria-current={step === item.id ? 'step' : undefined}
            disabled={dirty && step !== item.id}
            aria-pressed={step === item.id}
            onClick={() => setStep(item.id)}
          >
            <span className="team-step-number">{index + 1}</span>
            <span>{t(item.key)}</span>
            {counts[item.id] !== '' && (
              <small>{new Intl.NumberFormat(locale).format(Number(counts[item.id]))}</small>
            )}
          </button>
        ))}
      </nav>
      {step === 'sources' && (
        <TeamSources
          actions={actions}
          generated={() => setStep('scenarios')}
          contribute={() => setStep('proposals')}
        />
      )}
      {step === 'factors' && <FactorList actions={actions} />}
      {step === 'scenarios' && <ScenarioBoard actions={actions} onDirty={setDirty} />}
      {step === 'cases' && <CaseBoard actions={actions} />}
      {step === 'proposals' && <ContributionBoard actions={actions} />}
    </div>
  );
}
