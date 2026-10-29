import { useMemo, useState } from 'react';
import type { Conversations } from '../../app/useConversations';
import type { WorkflowRun } from '../../domain/runtime/types';
import { isReport } from '../../domain/execution/schema';
import { useI18n, isMessageKey } from '../../shared/i18n/context';
import { useTranscript } from './useTranscript';
import { transcriptTimeline, type TimelineEntry } from './transcript-timeline';
import { WorkflowCallCard } from './WorkflowCallCard';
import { SourceMessage } from './SourceMessage';
import { RunArtifactViewer } from './RunArtifactViewer';
import { RunReview } from './RunReview';
import { RunSummary } from './RunSummary';
import { ScriptQuestions } from './ScriptQuestions';
import { nodeLabel } from '../workflows/node-label';
import { useTranscriptScroll } from './useTranscriptScroll';
import { PendingAgentReply } from './AgentReplyStatus';

export function ConversationTimeline({
  actions,
  activeRun,
  openAssets,
}: {
  actions: Conversations;
  activeRun?: WorkflowRun;
  openAssets: (cases: boolean) => void;
}) {
  const { t } = useI18n();
  const { turns, error, loading } = useTranscript(actions.session?.id);
  const entries = useMemo(
    () => (actions.session ? transcriptTimeline(actions.session, turns) : []),
    [actions.session, turns],
  );
  const [visible, setVisible] = useState(60);
  const scrollRevision = useMemo(
    () => ({ entries, stream: actions.stream, busy: actions.busy }),
    [entries, actions.stream, actions.busy],
  );
  const anchor = useTranscriptScroll(scrollRevision);
  const [viewing, setViewing] = useState<{ run: WorkflowRun; key: string } | null>(null);
  const openArtifact = (run: WorkflowRun, key: string) => setViewing({ run, key });
  const missingHistory =
    !loading &&
    activeRun &&
    !turns.some((item) => item.runId === activeRun.id) &&
    ['completed', 'failed', 'interrupted'].includes(activeRun.status);
  const report = activeRun && Object.entries(activeRun.artifacts).find(([, item]) => isReport(item.value));
  return (
    <>
      {error && (
        <p className="wb-error session-transcript-notice" role="alert">
          {isMessageKey(error) ? t(error) : t('transcript_unavailable')}
        </p>
      )}
      {entries.length > visible && (
        <button className="workbench-btn wb-text" onClick={() => setVisible((count) => count + 60)}>
          {t('earlierConversation')}
        </button>
      )}
      {entries.slice(-visible).map((entry) =>
        entry.kind === 'message' ? (
          <article key={entry.id} className={`session-message role-${entry.message.role}`}>
            <div className="session-message-author">
              {t(entry.message.role === 'user' ? 'userMessage' : 'assistantMessage')}
            </div>
            {entry.message.text &&
              (entry.message.role === 'user' ? (
                <SourceMessage text={entry.message.text} />
              ) : (
                <div className="session-message-text">{entry.message.text}</div>
              ))}
            {entry.message.errorCode && (
              <p className="wb-error">
                {isMessageKey(entry.message.errorCode) ? t(entry.message.errorCode) : t('cli_failed')}
              </p>
            )}
          </article>
        ) : entry.kind === 'turn' ? (
          <WorkflowCallCard key={entry.id} turn={entry.turn} run={entry.run} openArtifact={openArtifact} />
        ) : (
          <DecisionEntry key={entry.id} entry={entry} openArtifact={openArtifact} />
        ),
      )}
      {missingHistory && <p className="session-transcript-notice">{t('legacyTranscriptMissing')}</p>}
      {activeRun?.status === 'awaiting_review' && (
        <section className="session-current-interaction">
          <h3>{t('currentReviewInConversation')}</h3>
          <RunReview run={activeRun} actions={actions} openAssets={openAssets} />
        </section>
      )}
      {activeRun && <ScriptQuestions key={activeRun.id} run={activeRun} actions={actions} />}
      {activeRun?.status === 'failed' && activeRun.errorCode !== 'review_unresolved' && (
        <section className="session-current-interaction">
          <h3>{t('workflowNeedsAttention')}</h3>
          <p className="wb-error">
            {activeRun.errorCode && isMessageKey(activeRun.errorCode)
              ? t(activeRun.errorCode)
              : t('cli_failed')}
          </p>
          <button
            className="workbench-btn"
            disabled={
              actions.busy ||
              activeRun.plan.some(
                (node) =>
                  node.operation === 'targets.execute' &&
                  ['failed', 'interrupted'].includes(activeRun.steps[node.id].status),
              )
            }
            onClick={() => void actions.retry(activeRun)}
          >
            {t('retryStep')}
          </button>
        </section>
      )}
      {activeRun?.status === 'completed' && report && (
        <section className="session-current-interaction">
          <h3>{t('workflowComplete')}</h3>
          <RunSummary value={report[1].value} />
          <button className="workbench-btn" onClick={() => openArtifact(activeRun, report[0])}>
            {t('openReport')}
          </button>
        </section>
      )}
      {viewing && (
        <RunArtifactViewer
          run={actions.session?.runs.find((run) => run.id === viewing.run.id) ?? viewing.run}
          updateRun={actions.busy ? undefined : actions.updateRun}
          selected={viewing.key}
          select={(key) => setViewing({ ...viewing, key })}
          close={() => setViewing(null)}
        />
      )}
      {actions.busy && (actions.session?.activeTurnId || !activeRun) && (
        <PendingAgentReply text={actions.stream} />
      )}
      <div ref={anchor} />
    </>
  );
}

function DecisionEntry({
  entry,
  openArtifact,
}: {
  entry: Exclude<TimelineEntry, { kind: 'message' | 'turn' }>;
  openArtifact: (run: WorkflowRun, key: string) => void;
}) {
  const { t, locale } = useI18n();
  const node =
    entry.kind === 'approval' ? entry.run.plan.find((item) => item.id === entry.nodeId) : undefined;
  return (
    <article className="session-decision-entry">
      <header>
        <strong>
          {t(
            entry.kind === 'approval'
              ? 'recordedApproval'
              : entry.kind === 'revision'
                ? 'scriptRevisions'
                : entry.kind === 'clarifications'
                  ? 'savedClarifications'
                  : 'savedExclusions',
          )}
        </strong>
        <time dateTime={entry.at}>
          {new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(entry.at))}
        </time>
      </header>
      {node && <p>{nodeLabel(node, entry.run.snapshot, t)}</p>}
      {(entry.kind === 'clarifications' || entry.kind === 'exclusions') && (
        <details>
          <summary>
            {t('recordedDecisionItems').replace(
              '{count}',
              new Intl.NumberFormat(locale).format(entry.items.length),
            )}
          </summary>
          {entry.items.map((item, index) => (
            <div key={index}>
              <p>{item.question}</p>
              <p>{item.answer}</p>
            </div>
          ))}
        </details>
      )}
      {entry.kind === 'revision' && (
        <button className="workbench-btn wb-text" onClick={() => openArtifact(entry.run, entry.artifactKey)}>
          {t('artifactPreviousScript')}
        </button>
      )}
    </article>
  );
}
