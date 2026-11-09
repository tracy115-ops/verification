import { useEffect, useState } from 'react';
import type { Conversations } from '../../app/useConversations';
import type { WorkflowRun } from '../../domain/runtime/types';
import { designProposals, proposalBaseDigest } from '../../domain/runtime/design-proposals';
import type { DesignProposal } from '../../domain/runtime/design-proposal-schema';
import { useI18n, isMessageKey } from '../../shared/i18n/context';
import { ReviewDialog } from './ReviewDialog';
import { FieldChanges } from '../team/FieldChanges';

export function DesignProposalPanel({ run, actions }: { run: WorkflowRun; actions: Conversations }) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState('');
  const [open, setOpen] = useState(false);
  const proposals = designProposals(run);
  const latestId = proposals.at(-1)?.id;
  useEffect(() => {
    setSelected(latestId ?? '');
    setOpen(false);
  }, [latestId]);
  const proposal =
    proposals.find((item) => item.id === selected) ??
    proposals.filter((item) => item.status === 'pending').at(-1) ??
    proposals.at(-1);
  const available = Object.values(run.artifacts).some((item) =>
    ['TestDesign', 'TestDesignDraft'].includes(item.type),
  );
  if (!available) return null;
  return (
    <section className="design-proposal-panel" aria-label={t('designProposalTitle')}>
      <header>
        <h3>{t('designProposalTitle')}</h3>
        <button
          className="workbench-btn wb-text"
          onClick={() =>
            actions.updateComposerDraft(
              { editDesign: true, editCases: false, invoke: false },
              actions.session?.profileId ?? run.defaultProfileId,
            )
          }
        >
          {t('designProposalStart')}
        </button>
      </header>
      {proposal && (
        <>
          {proposals.length > 1 && (
            <select
              className="workbench-select"
              aria-label={t('designProposalHistory')}
              value={proposal.id}
              onChange={(event) => {
                setSelected(event.target.value);
                setOpen(false);
              }}
            >
              {proposals.map((item) => (
                <option key={item.id} value={item.id}>
                  {new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
                    new Date(item.createdAt),
                  )}{' '}
                  · {item.patch.summary.slice(0, 40)}
                </option>
              ))}
            </select>
          )}
          <p>{proposal.patch.summary}</p>
          <small className="wb-muted">{t(`designProposal_${proposal.status}`)}</small>
          <button className="workbench-btn" onClick={() => setOpen(true)}>
            {t('designProposalReview')}
          </button>
          <ReviewDialog open={open} close={() => setOpen(false)} title="designProposalReview">
            <ProposalReview key={proposal.id} run={run} proposal={proposal} actions={actions} />
          </ReviewDialog>
        </>
      )}
    </section>
  );
}

function ProposalReview({
  run,
  proposal,
  actions,
}: {
  run: WorkflowRun;
  proposal: DesignProposal;
  actions: Conversations;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(0);
  const [current, setCurrent] = useState(false);
  useEffect(() => {
    let active = true;
    setCurrent(false);
    void proposalBaseDigest(run)
      .then((value) => {
        if (active) setCurrent(value === proposal.baseDigest);
      })
      .catch(() => {
        if (active) setCurrent(false);
      });
    return () => {
      active = false;
    };
  }, [run, proposal.baseDigest]);
  const changes = [
    ...proposal.patch.factors.map((change) => ({
      ...change,
      kind: 'factorItems' as const,
      before: proposal.before.factors.find((item) => item.id === change.value.id),
      title: change.value.name,
    })),
    ...proposal.patch.scenarios.map((change) => ({
      ...change,
      kind: 'scenarioItems' as const,
      before: proposal.before.scenarios.find((item) => item.id === change.value.id),
      title: change.value.title,
    })),
  ];
  const change = changes[selected];
  const pending = proposal.status === 'pending';
  return (
    <section className="design-proposal-review">
      <p>{proposal.patch.summary}</p>
      <details>
        <summary>{t('designProposalRequest')}</summary>
        <p>{proposal.instruction}</p>
      </details>
      <p className="wb-banner">{t('designProposalImpact')}</p>
      {pending && !current && <p className="wb-error">{t('design_proposal_stale')}</p>}
      {!!proposal.patch.questions.length && (
        <section>
          <h3>{t('designProposalQuestions')}</h3>
          <ul>
            {proposal.patch.questions.map((question, i) => (
              <li key={i}>{question}</li>
            ))}
          </ul>
        </section>
      )}
      {!!changes.length && (
        <div className="design-proposal-layout">
          <nav aria-label={t('designProposalChanges')}>
            {changes.map((item, i) => (
              <button
                key={`${item.kind}:${item.value.id}`}
                className="workbench-btn"
                aria-pressed={i === selected}
                onClick={() => setSelected(i)}
              >
                <small>
                  {t(item.action === 'add' ? 'designProposalAdd' : 'designProposalUpdate')} · {t(item.kind)} ·{' '}
                  {item.value.id}
                </small>
                <span>{item.title}</span>
              </button>
            ))}
          </nav>
          <div>
            <FieldChanges
              before={change?.before}
              after={change?.value}
              hideBefore={change?.action === 'add'}
            />
          </div>
        </div>
      )}
      <footer className="design-proposal-actions">
        {actions.error && (
          <p className="wb-error" role="alert">
            {t(isMessageKey(actions.error) ? actions.error : 'design_proposal_invalid')}
          </p>
        )}
        <span className="wb-muted">{t(`designProposal_${proposal.status}`)}</span>
        {pending && (
          <>
            <button
              className="workbench-btn"
              disabled={actions.busy}
              onClick={() => void actions.decideDesignProposal(run, proposal.id, false)}
            >
              {t('designProposalDismiss')}
            </button>
            <button
              className="workbench-btn wb-primary"
              disabled={
                actions.busy ||
                !current ||
                !changes.length ||
                !!proposal.patch.questions.length ||
                ['ready', 'running'].includes(run.status)
              }
              onClick={() => void actions.decideDesignProposal(run, proposal.id, true)}
            >
              {t('designProposalApply')}
            </button>
          </>
        )}
      </footer>
    </section>
  );
}
