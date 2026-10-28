import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { transcriptStore } from '../../services/transcript-store';

export function useTranscript(sessionId: string | undefined) {
  const state = useSyncExternalStore(transcriptStore.subscribe, transcriptStore.getSnapshot);
  const [loadedSession, setLoadedSession] = useState<string>();
  useEffect(() => {
    let current = true;
    if (sessionId)
      void transcriptStore.load(sessionId).then(() => {
        if (current) setLoadedSession(sessionId);
      });
    return () => {
      current = false;
    };
  }, [sessionId]);
  const turns = useMemo(
    () =>
      state.records
        .filter((item) => item.sessionId === sessionId)
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    [state.records, sessionId],
  );
  return { turns, error: state.error, loading: !!sessionId && loadedSession !== sessionId };
}
