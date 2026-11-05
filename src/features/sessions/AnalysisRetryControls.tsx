import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { Conversations } from '../../app/useConversations';
import type { WorkflowRun } from '../../domain/runtime/types';
import { canRetryAnalysisInBatches, retryNode } from '../../domain/runtime/analysis-retry';
import { hasDesktopBridge } from '../../services/agent-api';
import { useI18n } from '../../shared/i18n/context';

export function AnalysisRetryControls({ run, actions }: { run: WorkflowRun; actions: Conversations }) {
  const { t, locale } = useI18n();
  const [timeout, setTimeout] = useState('');
  const node = retryNode(run);
  if (!node) return null;
  const current = run.steps[node.id].analysisTimeoutSeconds ?? node.policy.timeoutSeconds;
  const disabled = !hasDesktopBridge() || actions.busy;
  const retry = (batch: boolean) => void actions.retry(run, batch, timeout ? Number(timeout) : undefined);
  return (
    <div className="wb-field">
      <label className="wb-field">
        <span>{t('retryAnalysisTimeout')}</span>
        <select
          className="workbench-select"
          value={timeout}
          disabled={disabled}
          title={t('retryAnalysisTimeoutHint')}
          onChange={(event) => setTimeout(event.target.value)}
        >
          <option value="">
            {t('retryTimeoutCurrent').replace('{seconds}', new Intl.NumberFormat(locale).format(current))}
          </option>
          {[1200, 1800].map((seconds) => (
            <option key={seconds} value={seconds}>
              {t('retryTimeoutMinutes').replace(
                '{minutes}',
                new Intl.NumberFormat(locale).format(seconds / 60),
              )}
            </option>
          ))}
        </select>
      </label>
      <button className="workbench-btn wb-full" disabled={disabled} onClick={() => retry(false)}>
        <RefreshCw size={15} />
        {t(run.errorCode === 'analysis_budget_paused' ? 'analysisContinueBudget' : 'retryStep')}
      </button>
      {canRetryAnalysisInBatches(run) && (
        <button
          className="workbench-btn wb-full"
          disabled={disabled}
          title={t('retryAnalysisInBatchesHint')}
          onClick={() => retry(true)}
        >
          {t('retryAnalysisInBatches')}
        </button>
      )}
    </div>
  );
}
