import { useRef } from 'react';
import { useI18n } from '../../shared/i18n/context';

export function ComposerInput({
  value,
  disabled,
  change,
  send,
}: {
  value: string;
  disabled: boolean;
  change: (value: string) => void;
  send: () => Promise<void>;
}) {
  const { t } = useI18n();
  const composing = useRef(false);
  return (
    <label className="wb-field">
      <span className="wb-sr-only">{t('composerPlaceholder')}</span>
      <textarea
        className="workbench-textarea"
        value={value}
        maxLength={40000}
        disabled={disabled}
        placeholder={t('composerPlaceholder')}
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
