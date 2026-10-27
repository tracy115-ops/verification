import { Channel, invoke } from '@tauri-apps/api/core';
import type { AgentEvent, AgentPort, TurnOutcome, TurnRequest } from '../domain/runtime/types';
import { hasDesktopBridge } from './agent-api';

function isEvent(value: unknown): value is AgentEvent {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  if (value.type === 'heartbeat') return true;
  if (value.type === 'text') return 'text' in value && typeof value.text === 'string';
  if (value.type === 'session') return 'id' in value && typeof value.id === 'string';
  return value.type === 'activity' && 'name' in value && typeof value.name === 'string';
}

function isOutcome(value: unknown): value is TurnOutcome {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'status' in value &&
    ['completed', 'failed', 'cancelled', 'timed_out'].includes(String(value.status)) &&
    'text' in value &&
    typeof value.text === 'string' &&
    'errorCode' in value &&
    (value.errorCode === null || typeof value.errorCode === 'string') &&
    'nativeSessionId' in value &&
    (value.nativeSessionId === null || typeof value.nativeSessionId === 'string')
  );
}

export class DesktopAgentPort implements AgentPort {
  async send(
    request: TurnRequest,
    onEvent: (event: AgentEvent) => void,
    signal: AbortSignal,
  ): Promise<TurnOutcome> {
    if (!hasDesktopBridge()) throw new Error('browser_only');
    if (new TextEncoder().encode(request.prompt).length > 131072) throw new Error('prompt_too_large');
    if (signal.aborted)
      return { status: 'cancelled', text: '', errorCode: 'cancelled', nativeSessionId: null };
    const channel = new Channel<unknown>();
    channel.onmessage = (value) => {
      if (isEvent(value)) onEvent(value);
    };
    const cancel = () => {
      void this.cancel(request.turnId).catch(() => {});
    };
    const timer = setInterval(() => {
      if (signal.aborted) cancel();
    }, 150);
    signal.addEventListener('abort', cancel, { once: true });
    try {
      const value: unknown = await invoke('send_cli_turn', { request, onEvent: channel });
      if (!isOutcome(value)) throw new Error('cli_protocol_invalid');
      return value;
    } finally {
      clearInterval(timer);
      signal.removeEventListener('abort', cancel);
    }
  }
  async cancel(turnId: string): Promise<void> {
    if (hasDesktopBridge()) await invoke('cancel_cli_turn', { turnId });
  }
}
