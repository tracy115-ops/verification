import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useI18n } from '../../shared/i18n/context';
import type { MessageKey } from '../../shared/i18n/messages';

export function ReviewDialog({
  open,
  close,
  children,
  title = 'reviewRequired',
  closeLabel = 'closeReview',
}: {
  open: boolean;
  close: () => void;
  children: ReactNode;
  title?: MessageKey;
  closeLabel?: MessageKey;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const { t } = useI18n();
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      className="session-review-dialog"
      onCancel={close}
      onClose={close}
    >
      <header>
        <h2 id={headingId}>{t(title)}</h2>
        <button className="workbench-btn" onClick={close}>
          {t(closeLabel)}
        </button>
      </header>
      {open && children}
    </dialog>
  );
}
