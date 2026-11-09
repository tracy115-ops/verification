import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useI18n } from '../../shared/i18n/context';
import type { MessageKey } from '../../shared/i18n/messages';

export function ReviewDialog({
  open,
  close,
  children,
  title = 'reviewRequired',
  closeLabel = 'closeReview',
  busy = false,
}: {
  open: boolean;
  close: () => void;
  children: ReactNode;
  title?: MessageKey;
  closeLabel?: MessageKey;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const { t } = useI18n();
  useEffect(() => {
    const dialog = ref.current;
    if (open) dialog?.showModal();
    else dialog?.close();
    return () => dialog?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      className="session-review-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
      onClose={(event) => {
        // Effect replay can queue a close event before reopening this same dialog.
        if (!event.currentTarget.open) close();
      }}
    >
      <header>
        <h2 id={headingId}>{t(title)}</h2>
        <button className="workbench-btn" disabled={busy} onClick={close}>
          {t(closeLabel)}
        </button>
      </header>
      {open && children}
    </dialog>
  );
}
