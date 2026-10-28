import type { WorkflowRun } from '../../domain/runtime/types';
import { useI18n } from '../../shared/i18n/context';
import { Status } from '../../shared/components/Status';
import { nodeLabel } from '../workflows/node-label';
import { latestArtifact } from '../../domain/runtime/bindings';
import { isDesign } from '../../domain/runtime/artifacts';
import { CASE_BATCH_SIZE } from '../../domain/runtime/case-batches';

const labels = {
  pending: 'pendingStep',
  running: 'runningStep',
  awaiting_review: 'reviewStep',
  succeeded: 'successStep',
  failed: 'failedStep',
  interrupted: 'interruptedStep',
} as const;
export function RunSteps({ run }: { run: WorkflowRun }) {
  const { t } = useI18n();
  const design = latestArtifact(run, 'TestDesign');
  const total = isDesign(design) ? Math.ceil(design.scenarios.length / CASE_BATCH_SIZE) : 0;
  return (
    <div className="session-flow-stages">
      {[
        {
          key: 'flowRequirements',
          operations: ['documents.import', 'requirements.extract', 'review.requirements'],
        },
        { key: 'flowDesign', operations: ['scenarios.design', 'review.coverage'] },
        { key: 'flowCases', operations: ['cases.generate', 'review.cases', 'tests.implement'] },
        { key: 'flowExecution', operations: ['targets.preflight', 'review.execution', 'targets.execute'] },
        { key: 'flowResults', operations: ['verdicts.evaluate', 'actions.dispatch'] },
        { key: 'flowOther', operations: ['review.custom'] },
      ].map((group, index) => {
        const nodes = run.plan.filter((node) => group.operations.includes(node.operation));
        if (!nodes.length) return null;
        const active = nodes.some((node) =>
          ['running', 'awaiting_review', 'failed', 'interrupted'].includes(run.steps[node.id].status),
        );
        const complete = nodes.filter((node) => run.steps[node.id].status === 'succeeded').length;
        return (
          <details
            className={`session-flow-stage ${active ? 'is-current' : ''}`}
            key={group.key}
            open={active}
          >
            <summary>
              <span className="session-stage-number">{index + 1}</span>
              <strong>{t(group.key as 'flowRequirements')}</strong>
              <small>
                {complete} / {nodes.length}
              </small>
            </summary>
            <ol className="session-step-list">
              {nodes.map((node) => {
                const step = run.steps[node.id];
                return (
                  <li key={node.id}>
                    <span>
                      {nodeLabel(node, run.snapshot, t)}
                      {!!step.caseBatches?.length && (
                        <small>
                          {' '}
                          · {t('completedBatches')}: {step.caseBatches.length}
                          {total ? ` / ${total}` : ''}
                        </small>
                      )}
                    </span>
                    <Status
                      tone={
                        step.status === 'succeeded'
                          ? 'success'
                          : step.status === 'failed'
                            ? 'danger'
                            : 'neutral'
                      }
                    >
                      {t(labels[step.status])}
                    </Status>
                  </li>
                );
              })}
            </ol>
          </details>
        );
      })}
    </div>
  );
}
export function CurrentStep({ run }: { run: WorkflowRun }) {
  const { t } = useI18n();
  const node = run.plan.find((node) =>
    ['running', 'awaiting_review', 'failed', 'interrupted'].includes(run.steps[node.id].status),
  );
  if (!node) return null;
  return (
    <div className="session-current-step">
      <small>{t('currentStep')}</small>
      <h2>{nodeLabel(node, run.snapshot, t)}</h2>
    </div>
  );
}
