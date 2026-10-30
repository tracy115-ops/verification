import { useState } from 'react';
import {
  canonical,
  collaboration,
  definition,
  type Change,
  type Contribution,
  type ProposalItem,
} from '../../domain/team/collaboration';
import { useI18n } from '../../shared/i18n/context';
import type { TeamActions } from './useTeam';
import { InlineTeamError } from './InlineTeamError';
import { FieldChanges } from './FieldChanges';

export function ContributionReview({
  actions,
  proposal,
  item,
}: {
  actions: TeamActions;
  proposal: Contribution;
  item: ProposalItem;
}) {
  const { t } = useI18n();
  const [comment, setComment] = useState('');
  const [edited, setEdited] = useState(JSON.stringify({ kind: item.kind, value: item.value }, null, 2));
  const [editing, setEditing] = useState(false);
  const project = actions.project!;
  const current = definition(project, item.kind, item.value.id);
  const stale = canonical(current) !== canonical(item.before);
  const name = 'title' in item.value ? item.value.title : item.value.name;
  const candidates =
    item.kind === 'factor'
      ? project.factors.map((value) => ({ id: value.id, name: value.name }))
      : item.kind === 'scenario'
        ? project.scenarios.map((value) => ({ id: value.id, name: value.title }))
        : collaboration(project).cases.map((value) => ({ id: value.id, name: value.title }));
  const duplicates = candidates.filter(
    (candidate) =>
      candidate.id !== item.value.id &&
      candidate.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
  );
  async function resolve(decision: 'accepted' | 'rejected') {
    try {
      const applied = editing ? (JSON.parse(edited) as Change) : undefined;
      await actions.command({
        type: 'resolve_proposal',
        proposalId: proposal.id,
        itemId: item.id,
        decision,
        comment,
        ...(applied && decision === 'accepted' ? { applied } : {}),
      });
    } catch {
      actions.setError('team_invalid');
    }
  }
  return (
    <article className="collab-detail">
      <InlineTeamError code={actions.error} />
      <h3>{name}</h3>
      <p>
        <code>{item.value.id}</code> · {proposal.source.kind} / {proposal.source.name} {proposal.source.runId}
      </p>
      <h4>{t('collab_reason')}</h4>
      <p>{item.reason}</p>
      {!!duplicates.length && (
        <p className="wb-banner">
          {t('collab_duplicate')} {duplicates.map((candidate) => candidate.id).join(', ')}
        </p>
      )}
      {stale && item.status === 'pending' && <p className="wb-error">{t('collab_proposal_stale')}</p>}
      <FieldChanges before={item.before} after={item.value} />
      {stale && (
        <details>
          <summary>{t('collab_current')}</summary>
          <pre>{JSON.stringify(current, null, 2)}</pre>
        </details>
      )}
      {item.resolution && (
        <p className="wb-banner">
          {t(`collab_${item.status}`)} ·{' '}
          {actions.members.find((member) => member.id === item.resolution?.by)?.name} ·{' '}
          {item.resolution.comment}
        </p>
      )}
      {item.status === 'pending' && ['admin', 'reviewer'].includes(actions.member?.role ?? '') && (
        <>
          <details onToggle={(event) => setEditing(event.currentTarget.open)}>
            <summary>{t('collab_edit_accept')}</summary>
            <textarea
              className="workbench-textarea wb-code"
              aria-label={t('collab_edit_accept')}
              value={edited}
              maxLength={100000}
              onChange={(event) => setEdited(event.target.value)}
            />
          </details>
          <label className="wb-field">
            {t('collab_comment')}
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
              disabled={actions.busy || !comment.trim()}
              onClick={() => void resolve('rejected')}
            >
              {t('collab_reject')}
            </button>
            <button
              className="workbench-btn wb-primary"
              disabled={actions.busy || stale}
              onClick={() => void resolve('accepted')}
            >
              {t('collab_accept')}
            </button>
          </div>
        </>
      )}
    </article>
  );
}
