import type { AgentProfile } from '../domain/workflow';
import type { AgentPort } from '../domain/runtime/types';
import { nativeAgentFields } from '../domain/runtime/profile';
import { newId } from '../shared/id';

export interface ConnectionResult {
  fingerprint: string;
  requestId: string;
  status: 'checking' | 'passed' | 'failed';
  checkedAt?: string;
  errorCode?: string;
}
let results: Record<string, ConnectionResult> = {};
const listeners = new Set<() => void>();
export const connectionSnapshot = () => results;
export function subscribeConnections(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function publish(next: typeof results) {
  results = next;
  for (const listener of listeners) listener();
}
export function invalidateConnections(profiles: AgentProfile[]) {
  const next = Object.fromEntries(
    Object.entries(results).filter(([id, result]) =>
      profiles.some((profile) => profile.id === id && JSON.stringify(profile) === result.fingerprint),
    ),
  );
  publish(next);
}
export function connectionFor(profile: AgentProfile, snapshot = results) {
  const result = snapshot[profile.id];
  return result?.fingerprint === JSON.stringify(profile) ? result : undefined;
}

export async function checkAgentConnection(profile: AgentProfile, port: AgentPort, signal: AbortSignal) {
  if (connectionFor(profile)?.status === 'checking') return;
  const requestId = newId();
  const fingerprint = JSON.stringify(profile);
  publish({ ...results, [profile.id]: { fingerprint, requestId, status: 'checking' } });
  let errorCode: string | undefined;
  try {
    const outcome = await port.send(
      {
        ...nativeAgentFields(profile),
        turnId: requestId,
        sessionId: newId(),
        timeoutSeconds: 60,
        prompt: 'Reply exactly WORKBENCH_CONNECTION_OK. Do not use tools or modify any files.',
      },
      () => {},
      signal,
    );
    if (signal.aborted || outcome.status === 'cancelled') errorCode = 'cancelled';
    else if (outcome.status !== 'completed') errorCode = outcome.errorCode ?? 'cli_failed';
    else if (outcome.text.trim() !== 'WORKBENCH_CONNECTION_OK') errorCode = 'cli_test_reply_invalid';
  } catch (error) {
    errorCode = signal.aborted
      ? 'cancelled'
      : typeof error === 'string'
        ? error
        : error instanceof Error
          ? error.message
          : 'cli_failed';
  }
  // A changed configuration or newer check owns its own result.
  if (results[profile.id]?.requestId !== requestId) return;
  publish({
    ...results,
    [profile.id]: {
      fingerprint,
      requestId,
      status: errorCode ? 'failed' : 'passed',
      checkedAt: new Date().toISOString(),
      ...(errorCode ? { errorCode } : {}),
    },
  });
}
