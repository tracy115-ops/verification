import { useState } from 'react';
import type { WorkflowRun } from '../../domain/runtime/types';
import {
  candidateReviews,
  candidateReviewReady,
  candidateReviewStatuses,
  type CandidateReviewStatus,
  type ReviewCandidate,
} from '../../domain/runtime/candidate-review';
import { useI18n } from '../../shared/i18n/context';
import { downloadText } from '../team/download';
import { useProtectedDraft } from '../../shared/drafts/context';
import { DraftActions } from '../settings/DraftActions';

export function CandidateReview({
  run,
  reportDigest,
  candidateId,
  saveReview,
}: {
  run: WorkflowRun;
  reportDigest: string;
  candidateId: string;
  saveReview?: ReviewCandidate;
}) {
  const { t, locale } = useI18n();
  const history = candidateReviews(run, reportDigest, candidateId);
  const latest = history.at(-1);
  const evidenceReady = candidateReviewReady(run, reportDigest, candidateId);
  const draft = useProtectedDraft({
    id: `candidate-review:${JSON.stringify([run.sessionId, run.id, reportDigest, candidateId])}`,
    initial: {
      status: latest?.status ?? ('needs_evidence' as CandidateReviewStatus),
      note: '',
      baseline: latest?.at ?? '',
    },
    section: 'runs',
    title: `${run.spec.slice(0, 32)} / ${candidateId}`,
    label: 'candidateReviewTitle',
  });
  const { status, note } = draft.value;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function save() {
    if (!saveReview || !note.trim() || busy || draft.conflicted) return;
    setBusy(true);
    setFailed(false);
    try {
      const accepted = await draft.persist(() =>
        saveReview(run, { reportDigest, candidateId, status, note }),
      );
      if (!accepted) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="candidate-review" aria-label={t('candidateReviewTitle')}>
      <div className="candidate-review-state">
        <strong>{t('candidateReviewTitle')}</strong>
        <span>{t(latest ? `candidate_review_${latest.status}` : 'candidateReviewPending')}</span>
      </div>
      {latest && <p className="candidate-review-note">{latest.note}</p>}
      {saveReview && run.status === 'completed' && (
        <details>
          <summary>{t(latest ? 'candidateReviewChange' : 'candidateReviewRecord')}</summary>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label className="wb-field">
              {t('candidateReviewDecision')}
              <select
                className="workbench-select"
                value={status}
                disabled={busy}
                onChange={(event) =>
                  draft.change({ ...draft.value, status: event.target.value as CandidateReviewStatus })
                }
              >
                {candidateReviewStatuses.map((item) => (
                  <option key={item} value={item} disabled={item !== 'needs_evidence' && !evidenceReady}>
                    {t(`candidate_review_${item}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="wb-field">
              {t('candidateReviewReason')}
              <textarea
                className="workbench-textarea"
                value={note}
                maxLength={4000}
                required
                disabled={busy}
                onChange={(event) => draft.change({ ...draft.value, note: event.target.value })}
              />
            </label>
            <p className="wb-muted">{t('candidateReviewHint')}</p>
            {!evidenceReady && <p className="wb-banner">{t('candidate_review_evidence')}</p>}
            <DraftActions dirty={draft.dirty} reset={draft.reset} busy={busy} conflicted={draft.conflicted} />
            <button
              className="workbench-btn"
              disabled={
                busy || !note.trim() || draft.conflicted || (status !== 'needs_evidence' && !evidenceReady)
              }
              type="submit"
            >
              {t('candidateReviewSave')}
            </button>
            {failed && (
              <p className="wb-error" role="alert">
                {t('candidateReviewSaveFailed')}
              </p>
            )}
          </form>
        </details>
      )}
      {!!history.length && (
        <details>
          <summary>
            {t('candidateReviewHistory')} · {new Intl.NumberFormat(locale).format(history.length)}
          </summary>
          <ol>
            {[...history].reverse().map((item, index) => (
              <li key={index}>
                <strong>{t(`candidate_review_${item.status}`)}</strong>
                <time dateTime={item.at}>
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
                    new Date(item.at),
                  )}
                </time>
                <p className="candidate-review-note">{item.note}</p>
              </li>
            ))}
          </ol>
          <button
            className="workbench-btn"
            onClick={() =>
              downloadText(
                `candidate-review-${candidateId}.json`,
                JSON.stringify(
                  {
                    version: 1,
                    kind: 'candidate-review',
                    runId: run.id,
                    sessionId: run.sessionId,
                    reportDigest,
                    candidateId,
                    events: history,
                  },
                  null,
                  2,
                ),
              )
            }
          >
            {t('candidateReviewExport')}
          </button>
        </details>
      )}
    </section>
  );
}
