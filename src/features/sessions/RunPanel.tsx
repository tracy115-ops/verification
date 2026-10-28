import { Check, RefreshCw, Square } from 'lucide-react';
import type { Conversations } from '../../app/useConversations';
import type { WorkflowRun } from '../../domain/runtime/types';
import { reviewIssues } from '../../domain/runtime/handlers';
import { useI18n, isMessageKey } from '../../shared/i18n/context';
import { Status } from '../../shared/components/Status';
import { RunSteps } from './RunSteps';
import { RunSummary } from './RunSummary';
import { ArtifactPanel } from './ArtifactPanel';
import { hasDesktopBridge } from '../../services/agent-api';
import { isExecutionPlan, isEvidence, isReport } from '../../domain/execution/schema';
import { ExecutionReview } from './ExecutionReview';
import { ClarificationReview, SavedClarifications, SavedExclusions } from './ClarificationReview';

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
      <RunSummary value={report} />
      {run.errorCode && (
        <p className="wb-error">{isMessageKey(run.errorCode) ? t(run.errorCode) : t('cli_failed')}</p>
      )}
      {pending && (
        <section className="session-review-card">
          <h3>{t('reviewRequired')}</h3>
          {!!issues.length && (
            <div className="wb-banner">
              <p>{t('unresolvedReview')}</p>
              {['review.requirements', 'review.coverage', 'review.cases'].includes(pending.operation) ? (
                <ClarificationReview
                  key={run.steps[pending.id].reviewDigest}
                  issues={issues}
                  exclusion={pending.operation !== 'review.requirements'}
                  busy={actions.busy || !hasDesktopBridge()}
                  save={(answers, exclude) =>
                    void actions.clarify(
                      run,
                      pending.id,
                      run.steps[pending.id].reviewDigest ?? '',
                      answers,
                      exclude,
                    )
                  }
                />
              ) : (
                <>
                  <ul>
                    {issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                  <p>{t('reviewResolutionHint')}</p>
                </>
              )}
            </div>
          )}
          {reviewArtifact && <ArtifactPanel artifact={reviewArtifact} />}
          {reviewArtifact && openAssets && (
            <button
              className="workbench-btn"
              onClick={() => openAssets(pending.operation === 'review.cases')}
            >
              {t('viewTaskAssets')}
            </button>
          )}
          {pending.operation === 'review.requirements' && (
            <SavedClarifications items={run.clarifications ?? []} />
          )}
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
      <RunSteps run={run} />
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
        {pending?.operation !== 'review.requirements' && (
          <SavedClarifications items={run.clarifications ?? []} />
        )}
        <SavedExclusions items={run.reviewExclusions ?? []} />
        {artifacts.map((artifact, index) => (
          <ArtifactPanel key={index} artifact={artifact} />
        ))}
      </div>
    </aside>
  );
}
