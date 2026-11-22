import { useState } from 'react';
import type { WorkflowRun } from '../../domain/runtime/types';
import { candidateReviewReady } from '../../domain/runtime/candidate-review';
import { candidateReproduction } from '../../domain/runtime/candidate-reproduction';
import { downloadText } from '../team/download';
import { useI18n } from '../../shared/i18n/context';
import type { StartReproduction } from '../../domain/runtime/reproduction-run';
import { hasDesktopBridge } from '../../services/agent-api';

export function CandidateReproduction({
  run,
  reportDigest,
  candidateId,
  startReproduction,
}: {
  run: WorkflowRun;
  reportDigest: string;
  candidateId: string;
  startReproduction?: StartReproduction;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const ready = candidateReviewReady(run, reportDigest, candidateId);
  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const bundle = await candidateReproduction(run, reportDigest, candidateId);
      downloadText(`reproduction-${candidateId}.json`, JSON.stringify(bundle, null, 2));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="candidate-reproduction">
      <button className="workbench-btn" disabled={!ready || busy} onClick={() => void download()}>
        {t('candidateReproductionExport')}
      </button>
      <span className="wb-muted">{t('candidateReproductionScope')}</span>
      {startReproduction && (
        <button
          className="workbench-btn"
          disabled={!ready || busy || !hasDesktopBridge()}
          onClick={() => void startReproduction(run, reportDigest, candidateId)}
        >
          {t('reproductionStart')}
        </button>
      )}
      {(failed || !ready) && (
        <p className="wb-error" role="status">
          {t('candidate_reproduction_unavailable')}
        </p>
      )}
    </div>
  );
}
