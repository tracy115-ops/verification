import { useState } from 'react';
import type { Conversations } from '../../app/useConversations';
import { designQuality } from '../../domain/runtime/design-quality';
import type { WorkflowRun } from '../../domain/runtime/types';
import { useI18n } from '../../shared/i18n/context';

export function DesignRepairButton({
  run,
  actions,
  onPrepared,
  kind = 'design',
}: {
  run: WorkflowRun;
  actions: Conversations;
  onPrepared: () => void;
  kind?: 'design' | 'cases';
}) {
  const { t } = useI18n();
  const [error, setError] = useState(false);
  const quality = designQuality(run);
  const findings = quality.findings.filter(
    (item) => item.state === 'open' && item.stage === (kind === 'cases' ? 'review.cases' : 'review.coverage'),
  );
  if (!quality.designGenerated || !findings.length) return null;
  return (
    <section className="design-repair-action">
      <button
        className="workbench-btn"
        disabled={actions.isSessionBusy(run.sessionId)}
        onClick={() => {
          const instruction = `${t(kind === 'cases' ? 'qualityCaseRepairPrompt' : 'qualityRepairPrompt')}\n\n${t('qualityRepairFocus')}\n${findings
            .slice(0, 10)
            .map(
              (item) =>
                `- ${item.id ? `${item.id} · ` : ''}${item.text.length > 240 ? `${item.text.slice(0, 240)}…` : item.text}`,
            )
            .join('\n')}`;
          if (
            !(kind === 'cases'
              ? actions.prepareCaseRepair(run, instruction)
              : actions.prepareDesignRepair(run, instruction))
          ) {
            setError(true);
            return;
          }
          actions.setSelectedRunId(run.id);
          setError(false);
          onPrepared();
        }}
      >
        {t(kind === 'cases' ? 'qualityCaseRepair' : 'qualityRepair')}
      </button>
      <small className="wb-muted">{t('qualityRepairHint')}</small>
      {error && (
        <p className="wb-error" role="alert">
          {t('qualityRepairFailed')}
        </p>
      )}
    </section>
  );
}
