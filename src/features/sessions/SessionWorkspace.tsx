import { Bot, MessageSquare, Plus, Workflow } from 'lucide-react';
import type { Conversations } from '../../app/useConversations';
import type { AgentProfile, WorkbenchDocument } from '../../domain/workflow';
import { hasDesktopBridge } from '../../services/agent-api';
import { isMessageKey, useI18n } from '../../shared/i18n/context';
import { ConversationComposer } from './ConversationComposer';
import { RunPanel } from './RunPanel';
import type { FrameworkProfile } from '../../domain/execution/types';

export function SessionWorkspace({
  actions,
  profiles,
  saved,
  dirty,
  openWorkflow,
  openSettings,
  frameworks,
  openAssets,
}: {
  actions: Conversations;
  profiles: AgentProfile[];
  saved: WorkbenchDocument | null;
  dirty: boolean;
  openWorkflow: () => void;
  openSettings: () => void;
  frameworks: FrameworkProfile[];
  openAssets: (cases: boolean) => void;
}) {
  const { t } = useI18n();
  const activeRun =
    actions.session?.runs.find((run) => run.id === actions.selectedRunId) ?? actions.session?.runs.at(-1);
  return (
    <div className={`session-workspace ${activeRun ? 'has-run' : ''}`}>
      <section className="session-conversation">
        <div className="session-toolbar">
          <label className="wb-field">
            <span className="wb-sr-only">{t('sessionHistory')}</span>
            <select
              className="workbench-select"
              aria-label={t('sessionHistory')}
              disabled={actions.busy}
              value={actions.activeId}
              onChange={(event) => actions.setActiveId(event.target.value)}
            >
              <option value="">{t('untitledSession')}</option>
              {actions.sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title || t('untitledSession')}
                </option>
              ))}
            </select>
          </label>
          <button className="workbench-btn" disabled={actions.busy} onClick={actions.newSession}>
            <Plus size={15} />
            {t('newSession')}
          </button>
          <button className="workbench-btn wb-text" onClick={openSettings}>
            <Bot size={15} />
            {t('configureAgent')}
          </button>
        </div>
        {!!actions.session?.runs.length && (
          <label className="wb-field session-run-picker">
            {t('runRecords')}
            <select
              className="workbench-select"
              value={activeRun?.id ?? ''}
              disabled={actions.busy}
              onChange={(event) => actions.setSelectedRunId(event.target.value)}
            >
              {actions.session.runs.map((run, index) => (
                <option key={run.id} value={run.id}>
                  {index + 1} · {run.snapshot.definition.name} · r{run.snapshot.revision}
                </option>
              ))}
            </select>
          </label>
        )}
        {!hasDesktopBridge() && (
          <div className="wb-banner session-browser-note">{t('browserConversation')}</div>
        )}
        {actions.session?.activeTurnId && !actions.busy && (
          <div className="wb-banner">
            <p>{t('previous_turn_active')}</p>
            <button
              className="workbench-btn"
              disabled={!hasDesktopBridge()}
              onClick={() => void actions.stopRecovered()}
            >
              {t('stopPreviousTurn')}
            </button>
          </div>
        )}
        <div className="session-messages" role="log" aria-label={t('sessions')}>
          {!actions.session?.messages.length && (
            <div className="session-welcome">
              <span className="wb-icon-tile">
                <MessageSquare size={23} />
              </span>
              <h2>{t('startConversation')}</h2>
              <p>{t('conversationSubtitle')}</p>
              <div className="session-workflow-shortcut">
                <Workflow size={20} />
                <div>
                  <strong>{saved?.definition.name ?? t('preset')}</strong>
                  <small>{t('designScope')}</small>
                </div>
                <button className="workbench-btn" onClick={openWorkflow}>
                  {t(saved ? 'workflow' : 'chooseFlowFirst')}
                </button>
              </div>
            </div>
          )}
          {actions.session?.messages.map((item) => (
            <article key={item.id} className={`session-message role-${item.role}`}>
              <div className="session-message-author">
                {t(item.role === 'user' ? 'userMessage' : 'assistantMessage')}
              </div>
              {item.text && <div className="session-message-text">{item.text}</div>}
              {item.errorCode && (
                <p className="wb-error">
                  {isMessageKey(item.errorCode) ? t(item.errorCode) : t('cli_failed')}
                </p>
              )}
            </article>
          ))}
          {actions.busy && (
            <article className="session-message role-assistant">
              <div className="session-message-author">
                <span className="app-environment-dot" />
                {t('generating')}
              </div>
              {actions.stream && (
                <details open={!activeRun}>
                  <summary>{t('streamingOutput')}</summary>
                  <pre>{actions.stream}</pre>
                </details>
              )}
            </article>
          )}
        </div>
        {actions.error && (
          <p className="session-error wb-error" role="alert">
            {isMessageKey(actions.error) ? t(actions.error) : t('cli_failed')}
          </p>
        )}
        <ConversationComposer
          key={actions.activeId}
          actions={actions}
          profiles={profiles}
          saved={saved}
          dirty={dirty}
          openWorkflow={openWorkflow}
          frameworks={frameworks}
        />
      </section>
      {activeRun && <RunPanel run={activeRun} actions={actions} openAssets={openAssets} />}
    </div>
  );
}
