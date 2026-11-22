import type { WorkflowRun } from '../../domain/runtime/types';
import { reproductionSource } from '../../domain/runtime/reproduction-source';
import { reproductionObservations } from '../../domain/runtime/reproduction-observations';
import type { StartReproduction } from '../../domain/runtime/reproduction-run';
import { candidateReviewReady } from '../../domain/runtime/candidate-review';
import { useI18n } from '../../shared/i18n/context';
import { hasDesktopBridge } from '../../services/agent-api';
import { linkedExecution } from '../../domain/runtime/execution-link';

export function ReproductionSummary({
  run,
  siblings,
  startReproduction,
  openArtifact,
  compact = false,
}: {
  run: WorkflowRun;
  siblings: WorkflowRun[];
  startReproduction?: StartReproduction;
  openArtifact?: (key: string) => void;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const source = reproductionSource(run);
  if (!source) return null;
  const original = siblings.find((item) => item.id === source.sourceRunId);
  const canStart = original && candidateReviewReady(original, source.reportDigest, source.candidateId);
  const evidence = Object.entries(run.artifacts).find(([, item]) => item.type === 'EvidenceBundle');
  const linked = linkedExecution(run);
  const currentEvidence =
    linked.plan?.scriptSha256 === source.scriptSha256 &&
    linked.plan.frameworkSha256 === source.frameworkSha256 &&
    linked.plan.payload.profile.targetUrl === source.targetUrl
      ? linked.evidence
      : undefined;
  const rows = reproductionObservations(run, siblings);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  return (
    <section className="reproduction-summary" aria-label={t('reproductionTitle')}>
      <h3>{t(compact && run.status === 'completed' ? 'reproductionComplete' : 'reproductionTitle')}</h3>
      <strong>{source.candidateTitle}</strong>
      <p className="wb-muted">{t('reproductionInheritedHint')}</p>
      {!compact && currentEvidence && (
        <div>
          <strong>{t('reproductionCurrentResults')}</strong>
          <div className="session-result-counts">
            {(['passed', 'failed', 'error', 'skipped'] as const).map((status) => (
              <span key={status}>
                {t(`result_${status}`)} ·{' '}
                {number(currentEvidence.results.filter((item) => item.status === status).length)}
              </span>
            ))}
          </div>
        </div>
      )}
      {!compact && <p className="wb-muted">{t('reproductionStatisticsHint')}</p>}
      {!compact && (
        <div className="reproduction-results">
          {rows.map((row) => (
            <article key={row.testName}>
              <code>{row.testName}</code>
              <strong>{t(`reproduction_${row.status}` as 'reproduction_not_run')}</strong>
              <div className="session-result-counts">
                {(['failed', 'passed', 'error', 'skipped'] as const).map((status) => (
                  <span key={status}>
                    {t(`result_${status}`)} · {number(row.counts[status])}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="candidate-reproduction">
        {evidence && currentEvidence && openArtifact && (
          <button className="workbench-btn" onClick={() => openArtifact(evidence[0])}>
            {t('reproductionEvidence')}
          </button>
        )}
        {startReproduction && original && (
          <button
            className="workbench-btn"
            disabled={
              !hasDesktopBridge() ||
              !canStart ||
              !['completed', 'failed', 'cancelled', 'interrupted'].includes(run.status)
            }
            onClick={() => void startReproduction(original, source.reportDigest, source.candidateId)}
          >
            {t('reproductionStartAgain')}
          </button>
        )}
      </div>
    </section>
  );
}
