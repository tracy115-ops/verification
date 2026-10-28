import { useState } from 'react';
import { caseIssues, scriptCoverage, type SharedCase } from '../../domain/team/collaboration';
import type { TeamActions } from './useTeam';
import { useI18n, isMessageKey } from '../../shared/i18n/context';
import { downloadText } from './download';
import { CaseDeclaration } from './CaseDeclaration';

export function CaseDetail({
  actions,
  item,
  edit,
}: {
  actions: TeamActions;
  item: SharedCase;
  edit: () => void;
}) {
  const { t } = useI18n();
  const [comment, setComment] = useState('');
  const coverage = scriptCoverage(actions.project!, item);
  const issues = caseIssues(actions.project!, item);
  const editor = ['admin', 'editor'].includes(actions.member?.role ?? '');
  const reviewer = ['admin', 'reviewer'].includes(actions.member?.role ?? '');
  return (
    <article className="collab-detail">
      <div className="collab-toolbar">
        <h3>{item.title}</h3>
        {editor && (
          <button className="workbench-btn" disabled={actions.busy} onClick={edit}>
            {t('collab_edit_case')}
          </button>
        )}
      </div>
      <p>
        <code>{item.id}</code> · r{item.revision} · {item.scenarioIds.join(', ')}
      </p>
      <h4>{t('collab_preconditions')}</h4>
      <ul>
        {item.preconditions.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <h4>{t('collab_steps')}</h4>
      <ol>
        {item.steps.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
      <h4>{t('collab_expected')}</h4>
      <p>{item.expected}</p>
      <h4>{t('collab_assertions')}</h4>
      <ul>
        {item.assertions.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <section className="collab-section">
        <h4>{t('collab_case_review')}</h4>
        <p>
          {t(
            item.review?.decision === 'accepted'
              ? 'team_accepted'
              : item.review?.decision === 'needs_changes'
                ? 'team_changes'
                : 'team_awaiting_review',
          )}
        </p>
        {issues.map((issue) => (
          <p className="wb-muted" key={issue}>
            {isMessageKey(issue) ? t(issue) : issue}
          </p>
        ))}
        {item.review && (
          <p>
            {actions.members.find((member) => member.id === item.review?.by)?.name} · {item.review.comment}
          </p>
        )}
        {reviewer && (
          <>
            <label className="wb-field">
              {t('team_review_comment')}
              <textarea
                className="workbench-textarea"
                value={comment}
                maxLength={12000}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
            <div className="collab-toolbar">
              <button
                className="workbench-btn"
                disabled={actions.busy}
                onClick={() =>
                  void actions.command({
                    type: 'review_case',
                    caseId: item.id,
                    caseRevision: item.revision,
                    decision: 'needs_changes',
                    comment,
                  })
                }
              >
                {t('team_request_changes')}
              </button>
              <button
                className="workbench-btn"
                disabled={actions.busy || !!issues.length}
                onClick={() =>
                  void actions.command({
                    type: 'review_case',
                    caseId: item.id,
                    caseRevision: item.revision,
                    decision: 'accepted',
                    comment,
                  })
                }
              >
                {t('collab_accept_case')}
              </button>
            </div>
          </>
        )}
      </section>
      <section className="collab-section">
        <h4>{t('collab_coverage')}</h4>
        <p className={`collab-light is-${coverage.status}`}>{t(`collab_${coverage.status}`)}</p>
        <p className="wb-muted">{t('collab_coverage_hint')}</p>
        {coverage.current.map(({ script, mapping }) => (
          <div key={script.id}>
            <strong>{script.name}</strong>
            <p>{mapping.testNames.join(', ')}</p>
            <code>{script.sha256}</code>
            <button className="workbench-btn" onClick={() => downloadText(script.name, script.source)}>
              {t('collab_download_script')}
            </button>
          </div>
        ))}
        {!!coverage.stale.length && <p className="wb-muted">{t('collab_case_stale')}</p>}
        {editor && <CaseDeclaration actions={actions} item={item} />}
        {item.declaration && (
          <p className="wb-muted">
            {actions.members.find((member) => member.id === item.declaration?.by)?.name} · r
            {item.declaration.caseRevision} · {item.declaration.note}
          </p>
        )}
      </section>
      <section className="collab-section">
        <h4>{t('collab_execution')}</h4>
        <p>{t(`collab_${coverage.execution}`)}</p>
        {coverage.current
          .filter(({ script }) => script.execution)
          .map(({ script }) => (
            <details key={script.id}>
              <summary>{script.execution!.executionId}</summary>
              <p>{t('collab_result_source')}</p>
              <code>{script.execution!.evidenceDigest}</code>
              <pre>{JSON.stringify(script.execution!.results, null, 2)}</pre>
            </details>
          ))}
      </section>
    </article>
  );
}
