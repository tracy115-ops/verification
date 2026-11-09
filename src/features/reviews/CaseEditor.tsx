import { useState } from 'react';
import type { Conversations } from '../../app/useConversations';
import type { WorkflowRun } from '../../domain/runtime/types';
import { caseContext } from '../../domain/runtime/case-revision';
import { useCaseDraft, type CaseDraftOptions } from './useCaseDraft';
import { useI18n } from '../../shared/i18n/context';
import { ReviewDialog } from '../sessions/ReviewDialog';
import { CaseLinks, CaseDetails } from './CaseEditorFields';
import type { CaseEditorTarget, CaseFormValue } from './case-editor-types';

function initialValue(run: WorkflowRun, target: CaseEditorTarget): CaseFormValue {
  const { cases } = caseContext(run);
  const source = cases.cases.find((item) => item.id === target.sourceId);
  if (target.mode !== 'add' && !source) throw new Error('artifact_invalid');
  const types = ['RequirementBaseline', 'TestDesign', 'TestCaseSet', 'TestCaseSetDraft'];
  const baseline = JSON.stringify(
    Object.values(run.artifacts)
      .filter((item) => types.includes(item.type))
      .map((item) => item.digest),
  );
  return {
    target,
    baseline,
    id: target.id,
    title: source?.title ?? '',
    scenarioIds: source?.scenarioIds ?? [],
    requirementIds: source?.requirementIds ?? [],
    preconditions: source?.preconditions.join('\n') ?? '',
    steps: source?.steps.join('\n') ?? '',
    expected: source?.expected ?? '',
    assertions: source?.assertions.join('\n') ?? '',
    reason: '',
  };
}

export function CaseEditor({
  target,
  actions,
  reopen,
  close,
  saved,
}: {
  target: CaseEditorTarget;
  actions: Conversations;
  reopen: () => void;
  close: () => void;
  saved: (id: string) => void;
}) {
  const { t } = useI18n();
  const run = actions.getSession(target.sessionId)?.runs.find((item) => item.id === target.runId);
  const [saving, setSaving] = useState(false);
  let initial: CaseFormValue | undefined;
  try {
    if (run) initial = initialValue(run, target);
  } catch {
    /* Preserve any pending draft for explicit recovery/discard. */
  }
  return (
    <ReviewDialog open close={close} title="caseEditor" closeLabel="caseKeepClose" busy={saving}>
      {run && initial ? (
        <CaseForm
          key={`${target.runId}:${target.id}`}
          run={run}
          initial={initial}
          actions={actions}
          reopen={reopen}
          saved={saved}
          saving={saving}
          setSaving={setSaving}
        />
      ) : (
        <p className="wb-error">{t('caseInvalid')}</p>
      )}
    </ReviewDialog>
  );
}

function CaseForm(props: CaseDraftOptions) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const { saving, actions } = props;
  const { draft, value, context, blocked, complete, error, save } = useCaseDraft(props);
  return (
    <form className="case-editor-form" onSubmit={(event) => void save(event)}>
      <p className="wb-muted">{t('caseEditHint')}</p>
      {draft.dirty && (
        <div className="case-draft-notice">
          <span role="status">
            {t(saving ? 'draftSaving' : draft.conflicted ? 'draftConflict' : 'draftPending')}
          </span>
          <button type="button" className="workbench-btn wb-text" disabled={saving} onClick={draft.reset}>
            {t('draftDiscard')}
          </button>
        </div>
      )}
      <nav className="case-editor-steps" aria-label={t('caseEditor')}>
        {(['caseLinks', 'caseStepsTab', 'caseReviewTab'] as const).map((label, index) => (
          <button
            type="button"
            key={label}
            className="workbench-btn"
            aria-current={step === index ? 'step' : undefined}
            disabled={blocked}
            onClick={() => setStep(index)}
          >
            {index + 1} · {t(label)}
          </button>
        ))}
      </nav>
      <fieldset
        className={`case-editor-content${step === 1 ? ' case-editor-details' : ''}`}
        disabled={blocked}
      >
        {step === 0 ? (
          <CaseLinks
            value={value}
            change={draft.change}
            requirements={context.requirements}
            design={context.design}
          />
        ) : step === 1 ? (
          <CaseDetails value={value} change={draft.change} />
        ) : (
          <>
            <strong>
              {value.id} · {value.title}
            </strong>
            <p>
              {value.scenarioIds.join(' · ')} / {value.requirementIds.join(' · ')}
            </p>
            <label className="wb-field">
              {t('caseReason')}
              <textarea
                aria-label={t('caseReason')}
                required
                className="workbench-textarea"
                maxLength={12000}
                value={value.reason}
                onChange={(event) => draft.change((current) => ({ ...current, reason: event.target.value }))}
              />
            </label>
            {!complete && <p className="wb-muted">{t('caseCompleteAll')}</p>}
          </>
        )}
      </fieldset>
      {error && (
        <p className="wb-error" role="alert">
          {t(actions.error === 'case_proposal_empty' ? 'case_proposal_empty' : 'caseInvalid')}
        </p>
      )}
      <div className="modal-actions">
        <button
          type="submit"
          className="workbench-btn wb-primary"
          disabled={!complete || blocked || draft.conflicted}
        >
          {t('caseSave')}
        </button>
      </div>
    </form>
  );
}
