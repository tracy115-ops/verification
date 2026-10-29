import { useState } from 'react';
import type { WorkflowRun } from '../../domain/runtime/types';
import { isCases, isDesign, isRequirements } from '../../domain/runtime/artifacts';
import { isEvidence, isReport } from '../../domain/execution/schema';
import { useI18n, isMessageKey } from '../../shared/i18n/context';
import { RunState, RunSummary } from '../sessions/RunSummary';
import { RunSteps } from '../sessions/RunSteps';
import { RunReport } from '../sessions/RunReport';
import { RunArtifactViewer } from '../sessions/RunArtifactViewer';
import { nodeLabel } from '../workflows/node-label';
import { useTranscript } from '../sessions/useTranscript';

export function RunDetails({
  run,
  title,
  busy,
  openSession,
  openAssets,
}: {
  run: WorkflowRun;
  title: string;
  busy: boolean;
  openSession: () => void;
  openAssets: () => void;
}) {
  const { t, locale } = useI18n();
  const [artifact, setArtifact] = useState<string | null>(null);
  const transcript = useTranscript(run.sessionId);
  const turns = transcript.turns.filter((item) => item.runId === run.id && item.finishedAt);
  const seconds =
    turns.reduce(
      (sum, item) => sum + Math.max(0, Date.parse(item.finishedAt!) - Date.parse(item.startedAt)),
      0,
    ) / 1000;
  const all = Object.values(run.artifacts);
  const requirements =
    all.find((item) => item.type === 'RequirementBaseline') ??
    all.find((item) => item.type === 'RequirementBaselineDraft');
  const design =
    all.find((item) => item.type === 'TestDesign') ?? all.find((item) => item.type === 'TestDesignDraft');
  const cases =
    all.find((item) => item.type === 'TestCaseSet') ?? all.find((item) => item.type === 'TestCaseSetDraft');
  const report = all.find((item) => isReport(item.value));
  const current =
    run.plan.find((node) =>
      ['failed', 'interrupted', 'awaiting_review', 'running'].includes(run.steps[node.id].status),
    ) ?? run.plan.find((node) => run.steps[node.id].status === 'pending');
  const counts = [
    ['requirementItems', isRequirements(requirements?.value) ? requirements.value.requirements.length : 0],
    ['factorItems', isDesign(design?.value) ? (design.value.factors?.length ?? 0) : 0],
    ['scenarioItems', isDesign(design?.value) ? design.value.scenarios.length : 0],
    ['caseItems', isCases(cases?.value) ? cases.value.cases.length : 0],
  ] as const;
  return (
    <article className="run-details">
      <header className="run-details-heading">
        <div>
          <h2>{title.replace(/^#+\s*/, '').split('\n')[0]}</h2>
          <p className="wb-muted">
            {run.snapshot.definition.name} · r{run.snapshot.revision}
          </p>
        </div>
        <RunState run={run} />
      </header>
      <p className="run-identity">
        <span>{t('runIdentifier')}</span>
        <code>{run.id}</code>
      </p>
      <div className="run-details-actions">
        <button className="workbench-btn" disabled={busy} onClick={openSession}>
          {t(current ? 'runHandle' : 'openConversation')}
        </button>
        <button
          className="workbench-btn"
          disabled={busy || !(requirements || design || cases)}
          onClick={openAssets}
        >
          {t('assetsTitle')}
        </button>
        <RunReport artifact={report} />
      </div>
      {current && (
        <div className="run-current">
          <strong>
            {t('currentStep')}: {nodeLabel(current, run.snapshot, t)}
          </strong>
          {run.errorCode && (
            <p className="wb-error">
              {isMessageKey(run.errorCode) ? t(run.errorCode) : t('cli_failed')} <code>{run.errorCode}</code>
            </p>
          )}
        </div>
      )}
      <div className="run-asset-counts">
        {counts.map(([key, count]) => (
          <div key={key}>
            <strong>{new Intl.NumberFormat(locale).format(count)}</strong>
            <small>{t(key)}</small>
          </div>
        ))}
      </div>
      <p className="wb-muted">
        {t('runRecordedCliTime')}:{' '}
        {turns.length
          ? t('runSeconds').replace(
              '{seconds}',
              new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(seconds),
            )
          : t('runTimeUnknown')}
      </p>
      <RunSummary value={report?.value} />
      {!report && (
        <p className="wb-muted">
          {t(
            run.scope === 'design'
              ? 'runDesignOnly'
              : all.some((item) => isEvidence(item.value))
                ? 'runAwaitingReport'
                : 'testsNotExecuted',
          )}
        </p>
      )}
      <h3>
        {t('workflowProgress')} ·{' '}
        {Object.values(run.steps).filter((step) => step.status === 'succeeded').length} / {run.plan.length}
      </h3>
      <RunSteps run={run} openArtifact={setArtifact} />
      <RunArtifactViewer
        run={run}
        selected={artifact}
        select={setArtifact}
        close={() => setArtifact(null)}
        closeLabel="designClose"
      />
    </article>
  );
}
