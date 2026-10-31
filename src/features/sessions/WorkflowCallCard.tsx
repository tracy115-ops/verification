import { useI18n, isMessageKey } from '../../shared/i18n/context';
import type { CliTurnRecord } from '../../domain/runtime/transcript';
import type { WorkflowRun } from '../../domain/runtime/types';
import { nodeLabel } from '../workflows/node-label';
import { CliReplyPreview } from './CliReplyPreview';
import { Status } from '../../shared/components/Status';
import { AgentReplyStatus } from './AgentReplyStatus';
import { useMemo } from 'react';
import { analysisMetadata } from '../../domain/runtime/analysis-metadata';
import { byteLength } from '../../domain/runtime/analysis-plan';
import { CliProgressSummary } from './CliProgressSummary';

export function WorkflowCallCard({
  turn,
  run,
  openArtifact,
}: {
  turn: CliTurnRecord;
  run: WorkflowRun;
  openArtifact: (run: WorkflowRun, key: string) => void;
}) {
  const { t, locale } = useI18n();
  const batch = useMemo(() => analysisMetadata(turn.request.prompt), [turn.request.prompt]);
  const inputBytes = useMemo(() => byteLength(turn.request.prompt), [turn.request.prompt]);
  const analysisCall = ['requirements.extract', 'scenarios.design'].includes(turn.operation);
  const node = run.plan.find((item) => item.id === turn.nodeId);
  const produced = node
    ? Object.keys(node.outputs)
        .map((slot) => `${node.id}.${slot}`)
        .find((key) => run.artifacts[key])
    : undefined;
  const error = turn.validationError ?? turn.errorCode;
  const repaired =
    node?.operation === 'requirements.extract' &&
    ['source_quote_invalid', 'source_quote_ambiguous'].includes(error ?? '') &&
    run.steps[node.id]?.status === 'succeeded' &&
    Object.values(run.artifacts).some((item) => item.type === 'RequirementQuoteRepair');
  const label = turn.validationError
    ? 'cliValidationRejected'
    : turn.status === 'running'
      ? 'runningStep'
      : turn.status === 'completed'
        ? 'cliReplyReceived'
        : turn.status === 'interrupted'
          ? 'interruptedStep'
          : turn.status === 'cancelled'
            ? 'cancelledRun'
            : 'failedStep';
  return (
    <article className="session-message role-assistant session-cli-turn">
      <header>
        <span className="session-message-author">
          {t('assistantMessage')} · {turn.request.driver}
          {turn.request.model ? ` / ${turn.request.model}` : ''}
        </span>
        <time dateTime={turn.startedAt}>
          {new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(
            new Date(turn.startedAt),
          )}
        </time>
      </header>
      <div className="session-cli-title">
        <h3>
          {node ? nodeLabel(node, run.snapshot, t) : turn.operation}
          {batch && (
            <small>
              {' '}
              · {t(batch.cross ? 'analysisCrossReviews' : 'analysisBatchLabel')} {batch.index} / {batch.total}
            </small>
          )}
          {analysisCall && !batch && <small> · {t('analysisSingleMode')}</small>}
        </h3>
        <Status tone={error && !repaired ? 'danger' : turn.status === 'completed' ? 'success' : 'accent'}>
          {t(repaired ? 'quoteRepairAppliedLabel' : label)}
        </Status>
      </div>
      <details className="session-cli-request">
        <summary>
          {t('actualAgentRequest')} ·{' '}
          {t('analysisInputBytes').replace('{bytes}', new Intl.NumberFormat(locale).format(inputBytes))}
        </summary>
        <pre>{turn.request.prompt}</pre>
      </details>
      {turn.text &&
        (turn.status === 'running' ? (
          <details>
            <summary>{t('streamingOutput')}</summary>
            <pre>{turn.text}</pre>
          </details>
        ) : (
          <>
            <span className="session-cli-reply-label">{t('actualAgentReply')}</span>
            <CliReplyPreview text={turn.text} batch={!!batch} />
            <details>
              <summary>{t('rawCliReply')}</summary>
              <pre>{turn.text}</pre>
            </details>
          </>
        ))}
      {turn.status === 'running' && <AgentReplyStatus />}
      <CliProgressSummary
        progress={turn.progress}
        timeoutSeconds={turn.request.timeoutSeconds}
        hasReply={!!turn.text}
        finished={turn.status !== 'running'}
      />
      {repaired && <p className="wb-muted">{t('quoteRepairApplied')}</p>}
      {error && !repaired && <p className="wb-error">{isMessageKey(error) ? t(error) : t('cli_failed')}</p>}
      {!!turn.activities.length && (
        <details>
          <summary>
            {t('cliActivities')} · {turn.activities.length}
          </summary>
          <ul>
            {turn.activities.map((activity, index) => (
              <li key={index}>
                {['analysis_batch', 'analysis_cross_review'].includes(activity.name) &&
                isMessageKey(activity.name)
                  ? t(activity.name)
                  : activity.name}
              </li>
            ))}
          </ul>
        </details>
      )}
      {produced && (
        <button className="workbench-btn wb-text" onClick={() => openArtifact(run, produced)}>
          {t('openCurrentNodeArtifact')}
        </button>
      )}
    </article>
  );
}
