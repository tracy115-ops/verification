import { invoke } from '@tauri-apps/api/core';
import type { DriverId } from '../domain/workflow';
import { validCliLaunch } from '../domain/cli-launch';

export interface CliInstance {
  driver: DriverId;
  executablePath: string;
}

export async function discoverCliInstances(): Promise<CliInstance[]> {
  const value: unknown = await invoke('discover_cli_instances');
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    !value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        ['claude', 'codex', 'codeagent', 'pi'].includes(item.driver) &&
        typeof item.executablePath === 'string' &&
        validCliLaunch({ executablePath: item.executablePath }, item.driver),
    )
  )
    throw new Error('discoveryFailed');
  return value;
}

export async function pickCliPath(kind: 'executable' | 'configuration'): Promise<string | null> {
  const value: unknown = await invoke('pick_cli_path', { kind });
  if (value === null) return null;
  if (typeof value !== 'string' || !validCliLaunch({ executablePath: value }, 'claude'))
    throw new Error('cliPickerFailed');
  return value;
}
