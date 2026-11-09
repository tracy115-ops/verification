import { useState } from 'react';
import type { Conversations } from '../../app/useConversations';
import type { CaseArtifact, WorkflowRun } from '../../domain/runtime/types';
import { caseContext } from '../../domain/runtime/case-revision';
import { useProtectedDraft } from '../../shared/drafts/context';
import type { CaseFormValue } from './case-editor-types';

export interface CaseDraftOptions {
  run: WorkflowRun;
  initial: CaseFormValue;
  actions: Conversations;
  reopen: () => void;
  saved: (id: string) => void;
  saving: boolean;
  setSaving: (value: boolean) => void;
}
export function useCaseDraft({ run, initial, actions, reopen, saved, saving, setSaving }: CaseDraftOptions) {
  const [error, setError] = useState(false);
  const draft = useProtectedDraft({
    id: `case-edit:${JSON.stringify([run.sessionId, run.id, initial.target.id])}`,
    initial,
    section: 'cases',
    title: initial.title || initial.id,
    label: 'caseEditor',
    open: reopen,
  });
  const value = draft.value;
  const context = caseContext(run);
  const blocked = saving || actions.isSessionBusy(run.sessionId) || ['ready', 'running'].includes(run.status);
  const complete = !!(
    value.title.trim() &&
    value.id &&
    value.scenarioIds.length &&
    value.requirementIds.length &&
    value.steps.trim() &&
    value.expected.trim() &&
    value.assertions.trim() &&
    value.reason.trim()
  );
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!complete || blocked || draft.conflicted) return;
    setSaving(true);
    setError(false);
    const lines = (text: string) =>
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    try {
      const item: CaseArtifact['cases'][number] = {
        id: value.id,
        title: value.title.trim(),
        scenarioIds: value.scenarioIds,
        requirementIds: value.requirementIds,
        preconditions: lines(value.preconditions),
        steps: lines(value.steps),
        expected: value.expected.trim(),
        assertions: lines(value.assertions),
      };
      if (initial.target.mode !== 'edit' && context.cases.cases.some((entry) => entry.id === item.id))
        throw new Error('artifact_invalid');
      const cases =
        initial.target.mode === 'edit'
          ? context.cases.cases.map((old) => (old.id === initial.target.sourceId ? item : old))
          : [...context.cases.cases, item];
      const accepted = await draft.persist(() => actions.reviseCases(run, { cases }, value.reason));
      if (accepted) saved(item.id);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }
  return { draft, value, context, blocked, complete, error, save };
}
