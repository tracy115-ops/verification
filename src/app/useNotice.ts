import { useCallback, useRef, useState } from 'react';
import type { MessageKey } from '../shared/i18n/messages';
import type { Notice } from '../shared/components/Toast';

function noticeFor(message: MessageKey, id: number): Notice {
  const success: MessageKey[] = ['savedMessage', 'settingsSaved', 'imported', 'exported', 'passed'];
  return {
    id,
    message,
    tone: success.includes(message) ? 'success' : message === 'browserOnly' ? 'info' : 'error',
  };
}

export function useNotice(initial: MessageKey | null) {
  const sequence = useRef(0);
  const [notice, setCurrent] = useState<Notice | null>(() => (initial ? noticeFor(initial, 0) : null));
  const setNotice = useCallback((message: MessageKey | null) => {
    setCurrent(message ? noticeFor(message, ++sequence.current) : null);
  }, []);
  const dismissNotice = useCallback((id: number) => {
    setCurrent((current) => (current?.id === id ? null : current));
  }, []);
  return { notice, setNotice, dismissNotice };
}
