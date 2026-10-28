import { Channel, invoke } from '@tauri-apps/api/core';
import { hasDesktopBridge } from './agent-api';
import { decodeEvidence, decodePlan } from '../domain/execution/validation';
import type {
  ExecutionPayload,
  ExecutionPlan,
  ExecutionPort,
  EvidenceBundle,
} from '../domain/execution/types';

export class DesktopExecutionPort implements ExecutionPort {
  private async call(
    command: string,
    payload: ExecutionPayload,
    signal: AbortSignal,
    approvedDigest?: string,
  ): Promise<unknown> {
    if (!hasDesktopBridge()) throw new Error('browser_only');
    if (signal.aborted) throw new Error('execution_cancelled');
    const channel = new Channel<unknown>();
    channel.onmessage = () => {};
    const cancel = () => {
      void this.cancel(payload.executionId).catch(() => {});
    };
    const timer = setInterval(() => {
      if (signal.aborted) cancel();
    }, 150);
    signal.addEventListener('abort', cancel, { once: true });
    try {
      return await invoke(command, { payload, approvedDigest, onEvent: channel });
    } catch (error) {
      throw new Error(typeof error === 'string' ? error : 'execution_failed');
    } finally {
      clearInterval(timer);
      signal.removeEventListener('abort', cancel);
    }
  }
  async preflight(payload: ExecutionPayload, signal: AbortSignal): Promise<ExecutionPlan> {
    return decodePlan(await this.call('preflight_python', payload, signal));
  }
  async execute(plan: ExecutionPlan, approvedDigest: string, signal: AbortSignal): Promise<EvidenceBundle> {
    return decodeEvidence(await this.call('execute_python', plan.payload, signal, approvedDigest), plan);
  }
  async cancel(executionId: string): Promise<void> {
    if (hasDesktopBridge()) await invoke('cancel_python', { executionId });
  }
}
