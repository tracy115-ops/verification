import { useEffect, useState } from 'react';
import type { Conversations } from './useConversations';
import { CaseEditor } from '../features/reviews/CaseEditor';
import type { CaseEditorTarget, CaseFocus, OpenCaseEditor } from '../features/reviews/case-editor-types';
import { useDraftStore } from '../shared/drafts/context';
import { newId } from '../shared/id';

export function useCaseEditing(actions: Conversations, navigate: () => void) {
  const [target, setTarget] = useState<CaseEditorTarget | null>(null);
  const [focus, setFocus] = useState<CaseFocus>();
  const drafts = useDraftStore();
  function reopen(value: CaseEditorTarget) {
    actions.setActiveId(value.sessionId);
    actions.setSelectedRunId(value.runId);
    navigate();
    setTarget(value);
  }
  const open: OpenCaseEditor = (run, sourceId, mode) =>
    reopen({
      sessionId: run.sessionId,
      runId: run.id,
      sourceId,
      mode,
      id: mode === 'edit' && sourceId ? sourceId : `TC_${newId().slice(0, 8)}`,
    });
  useEffect(() => {
    if (target && !actions.sessions.some((item) => item.id === target.sessionId)) setTarget(null);
    for (const entry of drafts?.snapshot() ?? []) {
      const source =
        entry.section === 'cases' && entry.value && typeof entry.value === 'object'
          ? (entry.value as { target?: CaseEditorTarget }).target
          : undefined;
      if (
        entry.section === 'cases' &&
        source &&
        !actions.sessions.some((item) => item.id === source.sessionId)
      )
        drafts?.discard(entry.id);
    }
  }, [actions.sessions, drafts, target]);
  return {
    open,
    focus,
    editor: target ? (
      <CaseEditor
        key={`${target.runId}:${target.id}`}
        target={target}
        actions={actions}
        close={() => setTarget(null)}
        saved={(id) => {
          setFocus({ sessionId: target.sessionId, runId: target.runId, id });
          setTarget(null);
        }}
        reopen={() => reopen(target)}
      />
    ) : null,
  };
}
