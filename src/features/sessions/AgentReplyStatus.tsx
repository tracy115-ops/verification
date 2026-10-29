import { useI18n } from '../../shared/i18n/context';

export function AgentReplyStatus() {
  const { t } = useI18n();
  return (
    <div className="session-reply-status" role="status">
      <span className="session-reply-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>{t('agentReplying')}</span>
    </div>
  );
}

export function PendingAgentReply({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <article className="session-message role-assistant session-pending-reply" aria-busy="true">
      <div className="session-message-author">{t('assistantMessage')}</div>
      {text && <div className="session-message-text">{text}</div>}
      <AgentReplyStatus />
    </article>
  );
}
