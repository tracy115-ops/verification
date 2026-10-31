import type { WorkflowRun } from '../../domain/runtime/types';
import { useI18n } from '../../shared/i18n/context';
import { Status } from '../../shared/components/Status';
import { nodeLabel } from '../workflows/node-label';
import { latestArtifact } from '../../domain/runtime/bindings';
import { isDesign } from '../../domain/runtime/artifacts';
import { CASE_BATCH_SIZE } from '../../domain/runtime/case-batches';
import { FileText } from 'lucide-react';
import { artifactLabel } from './artifact-labels';

const labels = {
  pending: 'pendingStep',
  running: 'runningStep',
  awaiting_review: 'reviewStep',
  succeeded: 'successStep',
  failed: 'failedStep',
  interrupted: 'interruptedStep',
} as const;
export function RunSteps({ run, openArtifact }: { run: WorkflowRun; openArtifact?: (key: string) => void }) {
  const { t, locale } = useI18n();
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
        const produced = nodes
          .flatMap((node) => Object.keys(node.outputs).map((slot) => `${node.id}.${slot}`))
          .filter((key) => run.artifacts[key]);
        return (
          <div className="session-flow-stage-wrap" key={group.key}>
            <details className={`session-flow-stage ${active ? 'is-current' : ''}`} open={active}>
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
                      <div className="session-step-heading">
                        <span>
                          {nodeLabel(node, run.snapshot, t)}
                          {step.analysis && (
                            <small>
                              {' '}
                              · {t('completedBatches')}: {step.analysis.completed.length} /{' '}
                              {step.analysis.total}
                              {step.analysis.kind === 'design' && (
                                <>
                                  {' '}
                                  · {t('analysisCrossReviews')}:{' '}
                                  {
                                    step.analysis.completed.filter(
                                      (item) => item.index >= step.analysis!.localTotal,
                                    ).length
                                  }{' '}
                                  / {step.analysis.total - step.analysis.localTotal}
                                </>
                              )}
                            </small>
                          )}
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
                      </div>
                      {openArtifact &&
                        Object.keys(node.outputs).map((slot) => {
                          const key = `${node.id}.${slot}`;
                          const artifact = run.artifacts[key];
                          return artifact ? (
                            <button
                              className="workbench-btn wb-text session-step-artifact"
                              key={key}
                              onClick={() => openArtifact(key)}
                            >
                              <FileText size={14} />
                              {artifactLabel(artifact, t, locale)}
                            </button>
                          ) : null;
                        })}
                    </li>
                  );
                })}
              </ol>
            </details>
            {openArtifact && !!produced.length && (
              <button
                className="workbench-btn wb-text session-stage-artifact"
                aria-label={t('openStageArtifact').replace('{stage}', t(group.key as 'flowRequirements'))}
                title={artifactLabel(run.artifacts[produced.at(-1)!], t, locale)}
                onClick={() => openArtifact(produced.at(-1)!)}
              >
                <FileText size={14} />
                {t('stageArtifacts')}
              </button>
            )}
          </div>
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
