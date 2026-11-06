import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { AgentProfile } from '../../domain/workflow';
import { DesktopAgentPort } from '../../services/conversation-api';
import {
  checkAgentConnection,
  connectionFor,
  connectionSnapshot,
  subscribeConnections,
} from '../../services/agent-connection';

export function useAgentConnection(profile: AgentProfile) {
  const snapshot = useSyncExternalStore(subscribeConnections, connectionSnapshot);
  const result = connectionFor(profile, snapshot);
  const controller = useRef<AbortController | null>(null);
  const activeFingerprint = useRef('');
  const fingerprint = JSON.stringify(profile);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (activeFingerprint.current && activeFingerprint.current !== fingerprint) controller.current?.abort();
  }, [fingerprint]);
  function start(selected = profile) {
    controller.current?.abort();
    controller.current = new AbortController();
    activeFingerprint.current = JSON.stringify(selected);
    void checkAgentConnection(selected, new DesktopAgentPort(), controller.current.signal);
  }
  return { result, busy: result?.status === 'checking', start, cancel: () => controller.current?.abort() };
}
