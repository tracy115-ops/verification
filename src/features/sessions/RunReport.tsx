import { useState } from 'react';
import { isReport } from '../../domain/execution/schema';
import { useI18n } from '../../shared/i18n/context';
import { ReviewDialog } from './ReviewDialog';
import { ExecutionArtifact } from './ExecutionArtifact';
import type { Artifact } from '../../domain/runtime/types';

export function RunReport({ artifact }: { artifact: Artifact | undefined }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!artifact || !isReport(artifact.value)) return null;
  return (
    <>
      <button className="workbench-btn" onClick={() => setOpen(true)}>
        {t('openReport')}
      </button>
      <ReviewDialog open={open} close={() => setOpen(false)} title="verificationReport">
        <section className="session-review-card">
          <ExecutionArtifact artifact={artifact} />
        </section>
      </ReviewDialog>
    </>
  );
}
