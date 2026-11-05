import { Check } from 'lucide-react';
import { useEffect, useState, useId } from 'react';
import type { Conversations } from '../../app/useConversations';
import type { WorkflowRun } from '../../domain/runtime/types';
import { reviewIssues } from '../../domain/runtime/handlers';
import { useI18n } from '../../shared/i18n/context';
import { hasDesktopBridge } from '../../services/agent-api';
import { isExecutionPlan } from '../../domain/execution/schema';
import { ReviewDialog } from './ReviewDialog';
import { ArtifactPanel } from './ArtifactPanel';
import { ExecutionReview } from './ExecutionReview';
import { ClarificationReview, SavedClarifications } from './ClarificationReview';
import { CaseScopeReview } from './CaseScopeReview';
import { AnalysisBudgetSummary } from './AnalysisBudgetSummary';
import { DESIGN_ATTEMPT_BATCH_LIMIT } from '../../domain/runtime/analysis-budget';

export function RunReview({
  run,
  actions,
  openAssets,
}: {
  run: WorkflowRun;
  actions: Conversations;
  openAssets?: (cases: boolean) => void;
}) {
  const { t } = useI18n();
  const budgetHintId = useId();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [budget, setBudget] = useState(DESIGN_ATTEMPT_BATCH_LIMIT);
  const pending =
    run.status === 'awaiting_review'
      ? run.plan.find((node) => run.steps[node.id].status === 'awaiting_review')
      : undefined;
  useEffect(() => {
    setReviewOpen(false);
    const design = run.plan.find((item) => item.operation === 'scenarios.design');
    setBudget(
      design
        ? (run.steps[design.id].analysisBatchBudget ?? DESIGN_ATTEMPT_BATCH_LIMIT)
        : DESIGN_ATTEMPT_BATCH_LIMIT,
    );
  }, [run.id, pending?.id]);
  let issues: string[] = [];
  try {
    if (pending) issues = reviewIssues(run, pending);
  } catch {
    issues = [t('artifact_invalid')];
  }
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

  return (
    <>
      {' '}
      {pending && (
        <>
          <button className="workbench-btn wb-primary" onClick={() => setReviewOpen(true)}>
            {t('openReview')}
          </button>
          <ReviewDialog open={reviewOpen} close={() => setReviewOpen(false)}>
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
              {pending.operation === 'review.requirements' && (
                <>
                  <SavedClarifications items={run.clarifications ?? []} />
                  {run.plan.some(
                    (item) => item.operation === 'scenarios.design' && item.dependsOn.includes(pending.id),
                  ) && (
                    <>
                      <AnalysisBudgetSummary run={run} />
                      <label className="wb-field">
                        {t('analysisInitialBudget')}
                        <select
                          className="workbench-select"
                          aria-label={t('analysisInitialBudget')}
                          aria-describedby={budgetHintId}
                          value={budget}
                          disabled={actions.busy || !hasDesktopBridge()}
                          onChange={(event) => setBudget(Number(event.target.value))}
                        >
                          {[1, 4, 8, 16, 32, 64].map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                        <small className="wb-muted" id={budgetHintId}>
                          {t('analysisInitialBudgetHint')}
                        </small>
                      </label>
                    </>
                  )}
                </>
              )}
              {reviewArtifact && <ArtifactPanel artifact={reviewArtifact} />}
              {pending.operation === 'review.cases' && (
                <CaseScopeReview
                  key={run.steps[pending.id].reviewDigest}
                  run={run}
                  nodeId={pending.id}
                  actions={actions}
                />
              )}
              {reviewArtifact && openAssets && (
                <button
                  className="workbench-btn"
                  onClick={() => openAssets(pending.operation === 'review.cases')}
                >
                  {t('viewTaskAssets')}
                </button>
              )}
              {isExecutionPlan(executionPlan) ? (
                <ExecutionReview
                  key={executionPlan.digest}
                  plan={executionPlan}
                  busy={!hasDesktopBridge() || actions.busy || !!issues.length}
                  approve={() =>
                    void actions.approve(run, pending.id, run.steps[pending.id].reviewDigest ?? '')
                  }
                />
              ) : (
                <button
                  className="workbench-btn wb-primary wb-full"
                  disabled={!hasDesktopBridge() || actions.busy || !!issues.length}
                  onClick={() =>
                    void actions.approve(
                      run,
                      pending.id,
                      run.steps[pending.id].reviewDigest ?? '',
                      pending.operation === 'review.requirements' &&
                        run.plan.some(
                          (item) =>
                            item.operation === 'scenarios.design' && item.dependsOn.includes(pending.id),
                        )
                        ? budget
                        : undefined,
                    )
                  }
                >
                  <Check size={15} />
                  {t('approveContinue')}
                </button>
              )}
            </section>
          </ReviewDialog>
        </>
      )}
    </>
  );
}
