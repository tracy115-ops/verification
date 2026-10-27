import { useEffect, useState } from 'react';
import type { ConversationSession, WorkflowRun } from '../domain/runtime/types';
import { loadConversations, saveConversations } from '../services/conversation-repository';

function initialState() {
  try {
    return { sessions: loadConversations(localStorage), error: null as string | null };
  } catch {
    return { sessions: [], error: 'session_storage_invalid' };
  }
}

export function useConversationStore() {
  const [initial] = useState(initialState);
  const [sessions, setSessions] = useState(initial.sessions);
  const [activeId, setActiveId] = useState(initial.sessions[0]?.id ?? '');
  const [error, setError] = useState<string | null>(initial.error);
  useEffect(() => {
    if (initial.error) return;
    try {
      saveConversations(localStorage, sessions);
    } catch {
      setError('session_storage_full');
    }
  }, [sessions, initial.error]);
  function changeSession(value: ConversationSession) {
    setSessions((current) =>
      current.some((item) => item.id === value.id)
        ? current.map((item) => (item.id === value.id ? value : item))
        : [...current, value],
    );
  }
  function updateRun(sessionId: string, run: WorkflowRun) {
    setSessions((current) =>
      current.map((item) =>
        item.id === sessionId
          ? { ...item, runs: item.runs.map((old) => (old.id === run.id ? run : old)) }
          : item,
      ),
    );
  }
  return {
    sessions,
    session: sessions.find((item) => item.id === activeId),
    activeId,
    setActiveId,
    error,
    setError,
    changeSession,
    updateRun,
  };
}
