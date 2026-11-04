import { useRef } from 'react';
import { useI18n } from '../../shared/i18n/context';
import type { MessageKey } from '../../shared/i18n/messages';

export function ComposerInput({
  value,
  disabled,
  change,
  send,
  placeholderKey = 'composerPlaceholder',
}: {
  value: string;
  disabled: boolean;
  change: (value: string) => void;
  send: () => Promise<void>;
  placeholderKey?: MessageKey;
}) {
  const { t } = useI18n();
  const composing = useRef(false);
  return (
    <label className="wb-field">
      <span className="wb-sr-only">{t(placeholderKey)}</span>
      <textarea
        className="workbench-textarea"
        value={value}
        maxLength={40000}
        disabled={disabled}
        placeholder={t(placeholderKey)}
        title={t('composerKeyboardHint')}
        onChange={(event) => change(event.target.value)}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        onKeyDown={(event) => {
          if (
            event.key !== 'Enter' ||
            event.shiftKey ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            composing.current ||
            event.nativeEvent.isComposing ||
            event.nativeEvent.keyCode === 229
          )
            return;
          event.preventDefault();
          if (!disabled) void send();
        }}
      />
    </label>
  );
}
