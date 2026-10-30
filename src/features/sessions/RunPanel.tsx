import { RefreshCw, Square } from 'lucide-react';
import { useState } from 'react';
import type { Conversations } from '../../app/useConversations';
import type { WorkflowRun } from '../../domain/runtime/types';
import { useI18n, isMessageKey } from '../../shared/i18n/context';
import { RunSteps, CurrentStep } from './RunSteps';
import { RunSummary, RunState } from './RunSummary';
import { hasDesktopBridge } from '../../services/agent-api';
import { isEvidence, isReport } from '../../domain/execution/schema';
import { RunDecisions } from './RunDecisions';
import { RunArtifactViewer } from './RunArtifactViewer';
import { ScriptQuestions } from './ScriptQuestions';
import { RunReport } from './RunReport';
import { RunReview } from './RunReview';
import { RequirementQuoteRepair } from './RequirementQuoteRepair';

export function RunPanel({
  run,
  actions,
  openAssets,
}: {
  run: WorkflowRun;
  actions: Conversations;
  openAssets?: (cases: boolean) => void;
}) {
  const { t } = useI18n();
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const executed = Object.values(run.artifacts).some((item) => isEvidence(item.value));
  const report = Object.values(run.artifacts).find((item) => isReport(item.value))?.value;
  const failedExecution = run.plan.some(
    (node) =>
      node.operation === 'targets.execute' && ['failed', 'interrupted'].includes(run.steps[node.id].status),
  );
  return (
    <aside className="session-run-panel" aria-label={t('workflowProgress')}>
      <div className="wb-panel-heading">
        <h2>{t('workflowProgress')}</h2>
        <RunState run={run} />
      </div>
      <div className="session-run-meta">
        <strong>{run.snapshot.definition.name}</strong>
        <span>
          {t('revision')} {run.snapshot.revision}
        </span>
        <small>
          {t('scopeNodes')}: {run.plan.length} / {run.snapshot.definition.nodes.length}
        </small>
        {!executed && <p>{t('testsNotExecuted')}</p>}
      </div>
      <RunSummary value={report} />
      <RunReport artifact={Object.values(run.artifacts).find((item) => isReport(item.value))} />
      <CurrentStep run={run} />
      {run.status === 'failed' &&
        ['source_quote_invalid', 'source_quote_ambiguous'].includes(run.errorCode ?? '') && (
          <RequirementQuoteRepair key={run.id} run={run} actions={actions} />
        )}
      <ScriptQuestions
        key={Object.values(run.artifacts).find((item) => item.type === 'ImplementationBundle')?.digest}
        run={run}
        actions={actions}
      />
      {actions.busy && (
        <button className="workbench-btn" onClick={() => actions.cancel()}>
          <Square size={14} />
          {t('stopGeneration')}
        </button>
      )}
      {run.errorCode && (
        <p className="wb-error">{isMessageKey(run.errorCode) ? t(run.errorCode) : t('cli_failed')}</p>
      )}
      <RunReview run={run} actions={actions} openAssets={openAssets} />
      <section className="session-flow-overview">
        <h3>
          {t('workflowProgress')} ·{' '}
          {Object.values(run.steps).filter((step) => step.status === 'succeeded').length} / {run.plan.length}
        </h3>
        <RunSteps run={run} openArtifact={setSelectedArtifact} />
      </section>
      {['failed', 'interrupted'].includes(run.status) && !failedExecution && (
        <button
          className="workbench-btn wb-full"
          disabled={!hasDesktopBridge() || actions.busy}
          onClick={() => void actions.retry(run)}
        >
          <RefreshCw size={15} />
          {t('retryStep')}
        </button>
      )}
      {failedExecution && (
        <div className="session-execution-recovery">
          <p>{t('noExecutionRetry')}</p>
          <button
            className="workbench-btn"
            disabled={!hasDesktopBridge() || actions.busy}
            onClick={() => void actions.closeExecution(run)}
          >
            {t('stopOldExecution')}
          </button>
        </div>
      )}
      {run.status === 'awaiting_review' && (
        <button className="workbench-btn wb-full" disabled={actions.busy} onClick={() => actions.cancel(run)}>
          <Square size={14} />
          {t('cancelRun')}
        </button>
      )}
      <RunDecisions run={run} openArtifact={setSelectedArtifact} />
      <RunArtifactViewer
        updateRun={actions.busy ? undefined : actions.updateRun}
        run={run}
        selected={selectedArtifact}
        select={setSelectedArtifact}
        close={() => setSelectedArtifact(null)}
      />
    </aside>
  );
}
