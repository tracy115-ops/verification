import { useState } from 'react';
import type { Conversations } from '../../app/useConversations';
import type { WorkflowRun } from '../../domain/runtime/types';
import { latestArtifact } from '../../domain/runtime/bindings';
import { isCases } from '../../domain/runtime/artifacts';
import { scopedCases } from '../../domain/runtime/case-scope';
import { useI18n } from '../../shared/i18n/context';

export function CaseScopeReview({
  run,
  nodeId,
  actions,
}: {
  run: WorkflowRun;
  nodeId: string;
  actions: Conversations;
}) {
  const { t } = useI18n();
  const [ids, setIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const draft = latestArtifact(run, 'TestCaseSetDraft');
  if (!isCases(draft)) return null;
  const cases = scopedCases(run, draft).cases;
  return (
    <details className="session-case-scope">
      <summary>
        {t('caseExecutionScope')} · {cases.length} / {draft.cases.length}
      </summary>
      <p>{t('caseExclusionHint')}</p>
      <div className="session-case-scope-list">
        {cases.map((item) => (
          <label key={item.id}>
            <input
              type="checkbox"
              checked={ids.includes(item.id)}
              disabled={actions.busy}
              onChange={(event) =>
                setIds((current) =>
                  event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                )
              }
            />
            <span>
              {item.id} · {item.title}
            </span>
          </label>
        ))}
      </div>
      <label className="wb-field">
        {t('caseExclusionReason')}
        <textarea
          className="workbench-textarea"
          value={reason}
          maxLength={12000}
          disabled={actions.busy}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button
        className="workbench-btn"
        disabled={actions.busy || !ids.length || ids.length >= cases.length || !reason.trim()}
        onClick={() =>
          void actions.excludeCases(run, nodeId, run.steps[nodeId].reviewDigest ?? '', ids, reason)
        }
      >
        {t('excludeSelectedCases')}
      </button>
    </details>
  );
}
