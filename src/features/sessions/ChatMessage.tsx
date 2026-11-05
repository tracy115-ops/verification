import type { ConversationMessage } from '../../domain/runtime/types';
import { useI18n, isMessageKey } from '../../shared/i18n/context';
import { SourceMessage } from './SourceMessage';

export function ChatMessage({
  message,
  openSettings,
}: {
  message: ConversationMessage;
  openSettings: () => void;
}) {
  const { t } = useI18n();
  const code = message.errorCode;
  const cli = message.cli;
  const modelError = code === 'cli_model_unavailable' || code === 'cli_model_ambiguous';
  const recovery =
    code === 'cli_auth_failed'
      ? 'chatSignInRecovery'
      : modelError
        ? cli?.driver === 'codeagent'
          ? 'chatInternalModelRecovery'
          : 'chatModelRecovery'
        : undefined;
  return (
    <article className={`session-message role-${message.role}`}>
      <div className="session-message-author">
        {t(message.role === 'user' ? 'userMessage' : 'assistantMessage')}
        {cli && (
          <>
            {' '}
            · {cli.driver}
            {cli.model ? ` / ${cli.model}` : ''}
          </>
        )}
      </div>
      {message.text &&
        (message.role === 'user' ? (
          <SourceMessage text={message.text} />
        ) : (
          <div className="session-message-text">{message.text}</div>
        ))}
      {code && (
        <div className="session-chat-failure">
          <p className="wb-error">
            {['cli_failed', 'cli_exit_failed'].includes(code)
              ? t('chatCallFailed')
              : modelError && cli?.driver === 'codeagent'
                ? t('chatInternalModelRecovery')
                : isMessageKey(code)
                  ? t(code)
                  : t('chatCallFailed')}
          </p>
          {recovery && recovery !== 'chatInternalModelRecovery' && <p>{t(recovery)}</p>}
          {recovery && (
            <button className="workbench-btn" onClick={openSettings}>
              {t('configureAgent')}
            </button>
          )}
          <details>
            <summary>{t('chatFailureDetails')}</summary>
            <code>{code}</code>
            {cli && (
              <p>
                <code>{cli.turnId}</code>
              </p>
            )}
          </details>
        </div>
      )}
    </article>
  );
}
