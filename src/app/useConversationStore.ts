import { useEffect, useState } from 'react';
import type { ConversationSession, WorkflowRun } from '../domain/runtime/types';
import { loadConversations, saveConversations } from '../services/conversation-repository';

const activeSessionKey = 'verification-workbench.active-conversation';

function restoredSelection(sessions: ConversationSession[]) {
  try {
    const selected = localStorage.getItem(activeSessionKey);
    if (sessions.some((item) => item.id === selected)) return selected!;
  } catch {
    /* Selection persistence must not prevent loading conversation records. */
  }
  return sessions.at(-1)?.id ?? '';
}

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
  const [activeId, setActiveId] = useState(() => restoredSelection(initial.sessions));
  const [error, setError] = useState<string | null>(initial.error);
  useEffect(() => {
    if (initial.error) return;
    try {
      localStorage.setItem(activeSessionKey, activeId);
    } catch {
      /* Conversation persistence reports its own errors below. */
    }
  }, [activeId, initial.error]);
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
  function renameSession(id: string, title: string): boolean {
    const value = title.trim();
    if (!sessions.some((item) => item.id === id) || !value || value.length > 120) return false;
    setSessions((current) => current.map((item) => (item.id === id ? { ...item, title: value } : item)));
    return true;
  }
  function deleteSession(id: string): boolean {
    const index = sessions.findIndex((item) => item.id === id);
    const item = sessions[index];
    if (
      !item ||
      item.activeTurnId ||
      item.runs.some((run) => ['ready', 'running', 'interrupted'].includes(run.status))
    )
      return false;
    const remaining = sessions.filter((item) => item.id !== id);
    setSessions(remaining);
    if (activeId === id) setActiveId(remaining[Math.min(index, remaining.length - 1)]?.id ?? '');
    return true;
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
    renameSession,
    deleteSession,
  };
}
