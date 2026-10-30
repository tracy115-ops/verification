import { chatContext, type ChatContextMode } from '../../domain/runtime/chat-context';
import type { ConversationMessage } from '../../domain/runtime/types';
import { useI18n } from '../../shared/i18n/context';

export function ChatContextControl({
  messages,
  draft,
  mode,
  change,
  disabled,
}: {
  messages: ConversationMessage[];
  draft: string;
  mode: ChatContextMode;
  change: (mode: ChatContextMode) => void;
  disabled: boolean;
}) {
  const { t, locale } = useI18n();
  const context = chatContext(
    [...messages, { role: 'user' as const, text: draft, status: 'complete' as const }],
    mode,
  );
  return (
    <label className="session-binding-choice wb-muted">
      {t('chatContextLabel')}
      <select
        className="workbench-select"
        aria-label={t('chatContextLabel')}
        disabled={disabled}
        value={mode}
        onChange={(event) => change(event.target.value as ChatContextMode)}
      >
        {(['recent', 'current', 'full'] as const).map((item) => (
          <option key={item} value={item}>
            {t(
              item === 'recent'
                ? 'chatContextRecent'
                : item === 'current'
                  ? 'chatContextCurrent'
                  : 'chatContextFull',
            )}
          </option>
        ))}
      </select>
      {context.omitted > 0 && (
        <span>
          {t('chatContextOmitted').replace('{count}', new Intl.NumberFormat(locale).format(context.omitted))}
        </span>
      )}
    </label>
  );
}
