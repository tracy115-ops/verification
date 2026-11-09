import { useEffect, useState } from 'react';
import type { Conversations } from '../../app/useConversations';
import type { WorkflowRun } from '../../domain/runtime/types';
import { caseProposals, caseProposalBaseDigest } from '../../domain/runtime/case-proposals';
import type { CaseProposal } from '../../domain/runtime/case-proposal-schema';
import { useI18n, isMessageKey } from '../../shared/i18n/context';
import { ReviewDialog } from './ReviewDialog';
import { FieldChanges } from '../team/FieldChanges';

export function CaseProposalPanel({ run, actions }: { run: WorkflowRun; actions: Conversations }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const proposals = caseProposals(run);
  const latest = proposals.at(-1);
  useEffect(() => {
    setSelected(latest?.id ?? '');
    setOpen(false);
  }, [latest?.id]);
  const proposal = proposals.find((item) => item.id === selected) ?? latest;
  if (!Object.values(run.artifacts).some((item) => ['TestCaseSet', 'TestCaseSetDraft'].includes(item.type)))
    return null;
  return (
    <section className="design-proposal-panel" aria-label={t('caseProposalTitle')}>
      <header>
        <h3>{t('caseProposalTitle')}</h3>
        <button
          className="workbench-btn wb-text"
          onClick={() => {
            if (actions.prepareCaseRepair(run)) actions.setSelectedRunId(run.id);
          }}
        >
          {t('caseProposalStart')}
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
            {t('caseProposalReview')}
          </button>
          <ReviewDialog open={open} close={() => setOpen(false)} title="caseProposalReview">
            <CaseProposalReview key={proposal.id} run={run} proposal={proposal} actions={actions} />
          </ReviewDialog>
        </>
      )}
    </section>
  );
}

function CaseProposalReview({
  run,
  proposal,
  actions,
}: {
  run: WorkflowRun;
  proposal: CaseProposal;
  actions: Conversations;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(0);
  const [current, setCurrent] = useState(false);
  useEffect(() => {
    let active = true;
    setCurrent(false);
    void caseProposalBaseDigest(run)
      .then((value) => {
        if (active) setCurrent(value === proposal.baseDigest);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [run, proposal.baseDigest]);
  const change = proposal.patch.cases[selected];
  const pending = proposal.status === 'pending';
  return (
    <section className="design-proposal-review">
      <p>{proposal.patch.summary}</p>
      <details>
        <summary>{t('designProposalRequest')}</summary>
        <p>{proposal.instruction}</p>
      </details>
      <p className="wb-banner">{t('caseProposalImpact')}</p>
      {pending && !current && <p className="wb-error">{t('case_proposal_stale')}</p>}
      {proposal.patch.questions.length > 0 && (
        <section>
          <h3>{t('designProposalQuestions')}</h3>
          <ul>
            {proposal.patch.questions.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      )}
      {change && (
        <div className="design-proposal-diff">
          <nav aria-label={t('designProposalChanges')}>
            {proposal.patch.cases.map((item, index) => (
              <button
                className="workbench-btn"
                key={item.value.id}
                aria-pressed={index === selected}
                onClick={() => setSelected(index)}
              >
                {t(item.action === 'add' ? 'designProposalAdd' : 'designProposalUpdate')} · {item.value.id} ·{' '}
                {item.value.title}
              </button>
            ))}
          </nav>
          <FieldChanges
            before={proposal.before.cases.find((item) => item.id === change.value.id)}
            after={change.value}
            hideBefore={change.action === 'add'}
          />
        </div>
      )}
      {actions.error && (
        <p className="wb-error" role="alert">
          {t(isMessageKey(actions.error) ? actions.error : 'case_proposal_invalid')}
        </p>
      )}
      {pending ? (
        <div className="modal-actions">
          <button
            className="workbench-btn"
            disabled={actions.busy}
            onClick={() => void actions.decideCaseProposal(run, proposal.id, false)}
          >
            {t('designProposalDismiss')}
          </button>
          <button
            className="workbench-btn wb-primary"
            disabled={actions.busy || !current || !!proposal.patch.questions.length}
            onClick={() => void actions.decideCaseProposal(run, proposal.id, true)}
          >
            {t('designProposalApply')}
          </button>
        </div>
      ) : (
        <p className="wb-muted">{t(`designProposal_${proposal.status}`)}</p>
      )}
    </section>
  );
}
