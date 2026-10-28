import { Bot, MessageSquare, PanelRight } from 'lucide-react';
import type { Conversations } from '../../app/useConversations';
import type { AgentProfile, WorkbenchDocument } from '../../domain/workflow';
import { hasDesktopBridge } from '../../services/agent-api';
import { isMessageKey, useI18n } from '../../shared/i18n/context';
import { ConversationComposer } from './ConversationComposer';
import { RunPanel } from './RunPanel';
import { SourceMessage } from './SourceMessage';
import type { FrameworkProfile } from '../../domain/execution/types';
import { useTaskPanel } from './useTaskPanel';

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
  const panel = useTaskPanel();
  const activeRun =
    actions.session?.runs.find((run) => run.id === actions.selectedRunId) ?? actions.session?.runs.at(-1);
  const composer = (
    <ConversationComposer
      key={actions.activeId}
      actions={actions}
      profiles={profiles}
      saved={saved}
      dirty={dirty}
      openWorkflow={openWorkflow}
      frameworks={frameworks}
    />
  );
  return (
    <div
      ref={panel.container}
      style={panel.style}
      className={`session-workspace ${activeRun ? 'has-run' : ''} ${panel.open ? 'has-task-panel' : ''} ${panel.resizing ? 'is-resizing' : ''}`}
    >
      <section className="session-conversation">
        <h1 className="wb-sr-only">{t('sessions')}</h1>
        <div className="session-toolbar">
          <strong className="session-title">
            {actions.session?.title.replace(/^#+\s*/, '').split('\n')[0] || t('untitledSession')}
          </strong>
          <button className="workbench-btn wb-text" onClick={openSettings}>
            <Bot size={15} />
            {t('configureAgent')}
          </button>
          <button
            className="workbench-btn wb-text"
            aria-label={t('toggleTaskPanel')}
            aria-expanded={panel.open}
            onClick={panel.toggle}
          >
            <PanelRight size={18} />
          </button>
        </div>
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
            </div>
          )}
          {actions.session?.messages.map((item) => (
            <article key={item.id} className={`session-message role-${item.role}`}>
              <div className="session-message-author">
                {t(item.role === 'user' ? 'userMessage' : 'assistantMessage')}
              </div>
              {item.text &&
                (activeRun ? (
                  <SourceMessage text={item.text} />
                ) : (
                  <div className="session-message-text">{item.text}</div>
                ))}
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
        {composer}
      </section>
      {panel.open && (
        <div
          className="session-panel-resizer"
          {...panel.separator}
          aria-label={t('resizeTaskPanel')}
          title={t('resizeTaskPanelHint')}
        />
      )}
      {panel.open &&
        (activeRun ? (
          <div className="session-task-column">
            {(actions.session?.runs.length ?? 0) > 1 && (
              <label className="wb-field session-run-picker">
                {t('runRecords')}
                <select
                  className="workbench-select"
                  value={activeRun.id}
                  disabled={actions.busy}
                  onChange={(event) => actions.setSelectedRunId(event.target.value)}
                >
                  {actions.session!.runs.map((run, index) => (
                    <option key={run.id} value={run.id}>
                      {index + 1} · {run.snapshot.definition.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <RunPanel run={activeRun} actions={actions} openAssets={openAssets} />
          </div>
        ) : (
          <aside className="session-task-empty">
            <h2>{t('taskPanel')}</h2>
            <p>{t('taskPanelEmpty')}</p>
            <button className="workbench-btn" onClick={openWorkflow}>
              {t('openWorkflowDesigner')}
            </button>
          </aside>
        ))}
    </div>
  );
}
