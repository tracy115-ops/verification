import { useState } from 'react';
import { isReport } from '../../domain/execution/schema';
import { useI18n } from '../../shared/i18n/context';
import { ReviewDialog } from './ReviewDialog';
import { ExecutionArtifact } from './ExecutionArtifact';
import type { Artifact, WorkflowRun } from '../../domain/runtime/types';
import type { ReviewCandidate } from '../../domain/runtime/candidate-review';
import type { StartReproduction } from '../../domain/runtime/reproduction-run';

export function RunReport({
  artifact,
  run,
  saveReview,
  startReproduction,
}: {
  artifact: Artifact | undefined;
  run?: WorkflowRun;
  saveReview?: ReviewCandidate;
  startReproduction?: StartReproduction;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!artifact || !isReport(artifact.value)) return null;
  return (
    <>
      <button className="workbench-btn" onClick={() => setOpen(true)}>
        {t('openReport')}
      </button>
      <ReviewDialog
        open={open}
        close={() => setOpen(false)}
        title="verificationReport"
        closeLabel="designClose"
      >
        <section className="session-review-card">
          <ExecutionArtifact
            artifact={artifact}
            run={run}
            saveReview={saveReview}
            startReproduction={startReproduction}
          />
        </section>
      </ReviewDialog>
    </>
  );
}
