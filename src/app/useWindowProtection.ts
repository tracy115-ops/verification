import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { hasDesktopBridge } from '../services/agent-api';
import { hasPendingConversationWrites, flushConversationStorage } from '../services/conversation-storage';

export function useWindowProtection(needsProtection: () => boolean) {
  const latest = useRef(needsProtection);
  latest.current = needsProtection;
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (latest.current() || hasPendingConversationWrites()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    let active = true;
    let unlisten: (() => void) | undefined;
    if (hasDesktopBridge()) {
      try {
        void getCurrentWindow()
          .onCloseRequested((event) => {
            if (latest.current()) {
              event.preventDefault();
              setClosing(true);
            } else if (hasPendingConversationWrites()) {
              event.preventDefault();
              void flushConversationStorage()
                .then(() => getCurrentWindow().destroy())
                .catch(() => {
                  setError(true);
                  setClosing(true);
                });
            }
          })
          .then((stop) => {
            if (active) {
              unlisten = stop;
              setReady(true);
            } else stop();
          })
          .catch(() => {
            if (active) setUnavailable(true);
          });
      } catch {
        /* Non-window IPC clients retain the browser unload guard. */
      }
    }
    return () => {
      active = false;
      unlisten?.();
      window.removeEventListener('beforeunload', warn);
    };
  }, []);
  async function close() {
    try {
      await flushConversationStorage();
      await getCurrentWindow().destroy();
    } catch {
      setError(true);
    }
  }
  return {
    closing,
    dismiss: () => {
      setClosing(false);
      setError(false);
    },
    close,
    error,
    ready,
    unavailable,
  };
}
