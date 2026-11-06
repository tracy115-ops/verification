import { useState } from 'react';
import { isReport } from '../../domain/execution/schema';
import { useI18n } from '../../shared/i18n/context';
import { ReviewDialog } from './ReviewDialog';
import { ExecutionArtifact } from './ExecutionArtifact';
import type { Artifact, WorkflowRun } from '../../domain/runtime/types';

export function RunReport({ artifact, run }: { artifact: Artifact | undefined; run?: WorkflowRun }) {
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
          <ExecutionArtifact artifact={artifact} run={run} />
        </section>
      </ReviewDialog>
    </>
  );
}
