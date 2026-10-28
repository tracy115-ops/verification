import { useState } from 'react';
import type { WorkflowRun } from '../../domain/runtime/types';
import { useI18n } from '../../shared/i18n/context';
import { ReviewDialog } from './ReviewDialog';

export function RunDecisions({
  run,
  openArtifact,
}: {
  run: WorkflowRun;
  openArtifact: (key: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'clarifications' | 'exclusions' | 'revisions'>('exclusions');
  const revisions = Object.entries(run.artifacts).filter(
    ([, item]) => item.type === 'ImplementationRevision',
  );
  const count = (run.clarifications?.length ?? 0) + (run.reviewExclusions?.length ?? 0) + revisions.length;
  if (!count) return null;
  return (
    <>
      <button className="workbench-btn session-decisions-link" onClick={() => setOpen(true)}>
        {t('reviewDecisions')} · {count}
      </button>
      <ReviewDialog open={open} close={() => setOpen(false)} title="reviewDecisions">
        <nav className="assets-tabs" aria-label={t('reviewDecisions')}>
          {(['clarifications', 'exclusions', 'revisions'] as const).map((kind) => (
            <button
              className="workbench-btn"
              key={kind}
              aria-pressed={tab === kind}
              onClick={() => setTab(kind)}
            >
              {t(
                kind === 'clarifications'
                  ? 'savedClarifications'
                  : kind === 'exclusions'
                    ? 'savedExclusions'
                    : 'scriptRevisions',
              )}
            </button>
          ))}
        </nav>
        <div className="session-artifact-reading">
          {tab === 'clarifications' &&
            run.clarifications?.map((item, index) => (
              <article key={index}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          {tab === 'exclusions' &&
            run.reviewExclusions?.map((item, index) => (
              <article key={index}>
                <h3>{item.issue}</h3>
                <p>{item.reason}</p>
              </article>
            ))}
          {tab === 'revisions' &&
            revisions.map(([key], index) => (
              <button
                className="workbench-btn"
                key={key}
                onClick={() => {
                  setOpen(false);
                  openArtifact(key);
                }}
              >
                {t('artifactPreviousScript')} · {index + 1}
              </button>
            ))}
        </div>
      </ReviewDialog>
    </>
  );
}
