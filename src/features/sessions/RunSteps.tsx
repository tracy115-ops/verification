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
    <ol className="session-step-list">
      {run.plan.map((node) => {
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
              tone={step.status === 'succeeded' ? 'success' : step.status === 'failed' ? 'danger' : 'neutral'}
            >
              {t(labels[step.status])}
            </Status>
          </li>
        );
      })}
    </ol>
  );
}
