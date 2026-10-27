import { useState } from 'react';
import type { TeamActions } from './useTeam';
import type { TeamScenario } from '../../domain/team/types';
import { readiness } from '../../domain/team/rules';
import { useI18n, isMessageKey } from '../../shared/i18n/context';

export function ScenarioReview({
  actions,
  scenario,
  dirty,
}: {
  actions: TeamActions;
  scenario: TeamScenario;
  dirty: boolean;
}) {
  const { t, locale } = useI18n();
  const project = actions.project!;
  const [comment, setComment] = useState('');
  const reviewer = ['admin', 'reviewer'].includes(actions.member?.role ?? '');
  const issues = readiness(scenario, project);
  const person = (id: string) => actions.members.find((item) => item.id === id)?.name ?? id;
  async function review(decision: 'accepted' | 'needs_changes') {
    if (await actions.command({ type: 'review', scenarioId: scenario.id, decision, comment })) setComment('');
  }
  async function addComment() {
    if (await actions.command({ type: 'comment', scenarioId: scenario.id, text: comment })) setComment('');
  }
  return (
    <>
      {!!issues.length && (
        <ul className="team-readiness">
          {issues.map((code) => (
            <li key={code}>{isMessageKey(code) ? t(code) : code}</li>
          ))}
        </ul>
      )}
      {scenario.review && (
        <div className="wb-banner">
          {t(scenario.review.decision === 'accepted' ? 'team_accepted' : 'team_changes')} ·{' '}
          {person(scenario.review.by)}
          <p>{scenario.review.comment}</p>
        </div>
      )}
      {actions.member?.role !== 'viewer' && (
        <>
          <label className="wb-field">
            {t('team_review_comment')}
            <textarea
              className="workbench-textarea"
              value={comment}
              maxLength={12000}
              disabled={actions.busy}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
          <div className="team-actions">
            <button
              className="workbench-btn"
              disabled={actions.busy || !comment.trim()}
              onClick={() => void addComment()}
            >
              {t('team_add_comment')}
            </button>
            {reviewer && (
              <>
                <button
                  className="workbench-btn"
                  disabled={actions.busy || dirty}
                  onClick={() => void review('needs_changes')}
                >
                  {t('team_request_changes')}
                </button>
                <button
                  className="workbench-btn wb-primary"
                  disabled={actions.busy || dirty || !!issues.length}
                  onClick={() => void review('accepted')}
                >
                  {t('team_accept')}
                </button>
              </>
            )}
          </div>
        </>
      )}
      <div className="team-comments">
        {project.comments
          .filter((item) => item.scenarioId === scenario.id)
          .map((item) => (
            <article key={item.id}>
              <small>
                {person(item.by)} ·{' '}
                {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
                  new Date(item.at),
                )}
              </small>
              <p>{item.text}</p>
            </article>
          ))}
      </div>
    </>
  );
}
