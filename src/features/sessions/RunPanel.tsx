import { Check, RefreshCw, Square } from 'lucide-react';
import type { Conversations } from '../../app/useConversations';
import type { WorkflowRun } from '../../domain/runtime/types';
import { reviewIssues } from '../../domain/runtime/handlers';
import { useI18n, isMessageKey } from '../../shared/i18n/context';
import { Status } from '../../shared/components/Status';
import { nodeLabel } from '../workflows/node-label';
import { ArtifactPanel } from './ArtifactPanel';
import { hasDesktopBridge } from '../../services/agent-api';
import { isExecutionPlan, isEvidence, isReport } from '../../domain/execution/schema';
import { ExecutionReview } from './ExecutionReview';

const labels = {
  pending: 'pendingStep',
  running: 'runningStep',
  awaiting_review: 'reviewStep',
  succeeded: 'successStep',
  failed: 'failedStep',
  interrupted: 'interruptedStep',
} as const;

export function RunPanel({ run, actions }: { run: WorkflowRun; actions: Conversations }) {
  const { t } = useI18n();
  const pending =
    run.status === 'awaiting_review'
      ? run.plan.find((node) => run.steps[node.id].status === 'awaiting_review')
      : undefined;
  let issues: string[] = [];
  try {
    if (pending) issues = reviewIssues(run, pending);
  } catch {
    issues = [t('artifact_invalid')];
  }
  const artifacts = Object.values(run.artifacts).filter(
    (item) =>
      !['DocumentRevision', 'RequirementBaselineDraft', 'TestDesignDraft', 'TestCaseSetDraft'].includes(
        item.type,
      ),
  );
  const reviewInputs = pending
    ? Object.values(pending.inputs)
        .map((input) => run.artifacts[input.from])
        .filter(Boolean)
    : [];
  const reviewArtifact = reviewInputs.find((item) =>
    ['RequirementBaselineDraft', 'TestDesignDraft', 'TestCaseSetDraft'].includes(item.type),
  );
  const executionPlan =
    pending?.operation === 'review.execution'
      ? reviewInputs.find((item) => isExecutionPlan(item.value))?.value
      : undefined;
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
        <Status tone={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'accent'}>
          {t(
            run.status === 'completed'
              ? run.scope === 'verification'
                ? 'workflowComplete'
                : 'designComplete'
              : run.status === 'failed'
                ? 'failedStep'
                : run.status === 'cancelled'
                  ? 'cancelledRun'
                  : run.status === 'interrupted'
                    ? 'interruptedStep'
                    : run.status === 'awaiting_review'
                      ? 'reviewStep'
                      : run.scope === 'verification'
                        ? 'verificationScope'
                        : 'designScope',
          )}
        </Status>
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
      {isReport(report) && (
        <div className="session-result-summary">
          <strong>{t(`execution_${report.status}`)}</strong>
          <div className="session-result-counts">
            {Object.entries(report.counts).map(([key, count]) => (
              <span key={key}>
                {t(`result_${key}` as 'result_passed')}: {count}
              </span>
            ))}
          </div>
          {report.candidates.length > 0 && (
            <span>
              {t('candidateDefects')}: {report.candidates.length}
            </span>
          )}
        </div>
      )}
      {run.errorCode && (
        <p className="wb-error">{isMessageKey(run.errorCode) ? t(run.errorCode) : t('cli_failed')}</p>
      )}
      {pending && (
        <section className="session-review-card">
          <h3>{t('reviewRequired')}</h3>
          {!!issues.length && (
            <div className="wb-banner">
              <p>{t('unresolvedReview')}</p>
              <ul>
                {issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
              <p>{t('reviewResolutionHint')}</p>
            </div>
          )}
          {reviewArtifact && <ArtifactPanel artifact={reviewArtifact} />}
          {isExecutionPlan(executionPlan) ? (
            <ExecutionReview
              key={executionPlan.digest}
              plan={executionPlan}
              busy={!hasDesktopBridge() || actions.busy || !!issues.length}
              approve={() => void actions.approve(run, pending.id, run.steps[pending.id].reviewDigest ?? '')}
            />
          ) : (
            <button
              className="workbench-btn wb-primary wb-full"
              disabled={!hasDesktopBridge() || actions.busy || !!issues.length}
              onClick={() => void actions.approve(run, pending.id, run.steps[pending.id].reviewDigest ?? '')}
            >
              <Check size={15} />
              {t('approveContinue')}
            </button>
          )}
        </section>
      )}
      <ol className="session-step-list">
        {run.plan.map((node) => (
          <li key={node.id}>
            <span>{nodeLabel(node, run.snapshot, t)}</span>
            <Status
              tone={
                run.steps[node.id].status === 'succeeded'
                  ? 'success'
                  : run.steps[node.id].status === 'failed'
                    ? 'danger'
                    : 'neutral'
              }
            >
              {t(labels[run.steps[node.id].status])}
            </Status>
          </li>
        ))}
      </ol>
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
      <div className="session-run-artifacts">
        <h3>{t('artifactTitle')}</h3>
        {artifacts.map((artifact, index) => (
          <ArtifactPanel key={index} artifact={artifact} />
        ))}
      </div>
    </aside>
  );
}
