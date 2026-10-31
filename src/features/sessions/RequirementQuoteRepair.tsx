import { useMemo, useState } from 'react';
import type { Conversations } from '../../app/useConversations';
import type { WorkflowRun } from '../../domain/runtime/types';
import { isRequirements, parseArtifact } from '../../domain/runtime/artifacts';
import { quoteIssues } from '../../domain/runtime/source-quotes';
import { useI18n } from '../../shared/i18n/context';
import { useTranscript } from './useTranscript';

export function RequirementQuoteRepair({ run, actions }: { run: WorkflowRun; actions: Conversations }) {
  const { t } = useI18n();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState('');
  const transcript = useTranscript(run.sessionId);
  const node = run.plan.find((item) => item.operation === 'requirements.extract');
  const batched = !!(node && run.steps[node.id].analysis);
  const stored = node ? run.artifacts[`${node.id}.${Object.keys(node.outputs)[0]}`]?.value : undefined;
  const draft = useMemo(() => {
    if (isRequirements(stored)) return stored;
    const turn = transcript.turns.find(
      (item) => item.id === (node && run.steps[node.id].turnId) && item.runId === run.id,
    );
    try {
      const value = turn && parseArtifact(turn.text);
      return isRequirements(value) ? value : undefined;
    } catch {
      return undefined;
    }
  }, [stored, transcript.turns, node, run]);
  const issues = useMemo(() => (draft ? quoteIssues(draft.requirements, run.spec) : []), [draft, run.spec]);
  const issue = issues.find((item) => item.id === selected) ?? issues[0];
  const current = draft?.requirements.find((item) => item.id === issue?.id);
  return (
    <section className="session-quote-repair">
      <h3>
        {t('quoteRepairTitle')} · {issues.length}
      </h3>
      <p className="wb-muted">{t(batched ? 'quoteRepairBatchHint' : 'quoteRepairHint')}</p>
      {!draft && <p>{t(transcript.loading ? 'quoteRepairLoading' : 'quoteRepairUnavailable')}</p>}
      {draft && !issues.length && (
        <>
          <p>{t('quoteRepairFormatting')}</p>
          <button
            className="workbench-btn"
            disabled={actions.busy}
            onClick={() => void actions.repairQuotes(run, {})}
          >
            {t(batched ? 'quoteRepairBatchSave' : 'quoteRepairSave')}
          </button>
        </>
      )}
      {draft && current && (
        <>
          <label className="wb-field">
            {t('quoteRepairItem')}
            <select
              className="workbench-select"
              disabled={actions.busy}
              value={current.id}
              onChange={(event) => setSelected(event.target.value)}
            >
              {issues.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.id} ·{' '}
                  {draft.requirements.find((requirement) => requirement.id === item.id)?.text.slice(0, 80)}
                </option>
              ))}
            </select>
          </label>
          <p>{current.text}</p>
          <label className="wb-field">
            {t('quoteRepairQuote')}
            <textarea
              className="workbench-textarea"
              maxLength={12000}
              disabled={actions.busy}
              value={edits[current.id] ?? current.quote}
              onChange={(event) => setEdits((value) => ({ ...value, [current.id]: event.target.value }))}
            />
          </label>
          <details>
            <summary>{t('quoteRepairSource')}</summary>
            <pre>{run.spec}</pre>
          </details>
          <button
            className="workbench-btn"
            disabled={actions.busy || !Object.keys(edits).length}
            onClick={() => void actions.repairQuotes(run, edits)}
          >
            {t(batched ? 'quoteRepairBatchSave' : 'quoteRepairSave')}
          </button>
        </>
      )}
    </section>
  );
}
