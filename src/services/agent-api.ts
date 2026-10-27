import { invoke, isTauri } from '@tauri-apps/api/core';
import type { DriverId } from '../domain/workflow';

export interface AgentProbe {
  driver: DriverId;
  status: 'found' | 'missing' | 'error' | 'timeout';
  version: string | null;
  executable: string | null;
}

function isProbe(value: unknown): value is AgentProbe {
  if (typeof value !== 'object' || value === null) return false;
  if (!('driver' in value) || !['codeagent', 'claude', 'codex', 'pi'].includes(String(value.driver)))
    return false;
  if (!('status' in value) || !['found', 'missing', 'error', 'timeout'].includes(String(value.status)))
    return false;
  return (
    'version' in value &&
    (value.version === null || typeof value.version === 'string') &&
    'executable' in value &&
    (value.executable === null || typeof value.executable === 'string')
  );
}

export function hasDesktopBridge(): boolean {
  return isTauri();
}

export async function probeAgents(): Promise<AgentProbe[]> {
  if (!hasDesktopBridge()) throw new Error('browserOnly');
  const result: unknown = await invoke('probe_agents');
  if (!Array.isArray(result) || !result.every(isProbe)) throw new Error('discoveryFailed');
  return result;
}
