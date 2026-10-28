import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { useI18n } from '../i18n/context';
import type { MessageKey } from '../i18n/messages';

export interface Notice {
  id: number;
  message: MessageKey;
  tone: 'success' | 'error' | 'info';
}

export function Toast({ notice, dismiss }: { notice: Notice; dismiss: (id: number) => void }) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (notice.tone === 'error' || hovered || focused) return;
    const timer = window.setTimeout(() => dismiss(notice.id), 4000);
    return () => window.clearTimeout(timer);
  }, [notice.id, notice.tone, hovered, focused, dismiss]);
  const Icon = notice.tone === 'success' ? CheckCircle2 : notice.tone === 'error' ? CircleAlert : Info;
  return createPortal(
    <div className="wb-toast-region">
      <div
        className={`wb-toast wb-toast-${notice.tone}`}
        role={notice.tone === 'error' ? 'alert' : 'status'}
        aria-atomic="true"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
      >
        <Icon size={18} aria-hidden="true" />
        <span>{t(notice.message)}</span>
        <button
          className="workbench-btn wb-text wb-toast-close"
          aria-label={t('dismissNotification')}
          onClick={() => dismiss(notice.id)}
        >
          <X size={15} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
