import { Channel, invoke } from '@tauri-apps/api/core';
export interface UpdateRelease {
  version: string;
  notes: string;
  publishedAt: string;
  releaseUrl: string;
  size: number;
}
export interface UpdateStatus {
  currentVersion: string;
  supported: boolean;
  release: UpdateRelease | null;
  ready: boolean;
}
export interface UpdateProgress {
  downloaded: number;
  total: number;
}
export interface LogFile {
  name: 'workbench.log' | 'workbench.1.log';
  bytes: number;
  text: string;
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function status(value: unknown): UpdateStatus {
  if (
    !object(value) ||
    typeof value.currentVersion !== 'string' ||
    typeof value.supported !== 'boolean' ||
    typeof value.ready !== 'boolean'
  )
    throw new Error('update_invalid_release');
  const release = value.release;
  if (
    release !== null &&
    (!object(release) ||
      typeof release.version !== 'string' ||
      typeof release.notes !== 'string' ||
      release.notes.length > 65536 ||
      typeof release.publishedAt !== 'string' ||
      typeof release.releaseUrl !== 'string' ||
      !release.releaseUrl.startsWith('https://github.com/tracy115-ops/verification/releases/tag/v') ||
      typeof release.size !== 'number' ||
      !Number.isSafeInteger(release.size) ||
      release.size <= 0 ||
      release.size > 256 * 1024 * 1024)
  )
    throw new Error('update_invalid_release');
  return value as unknown as UpdateStatus;
}
export async function updateStatus() {
  return status(await invoke('update_status'));
}
export async function checkUpdate() {
  return status(await invoke('check_update'));
}
export async function downloadUpdate(progress: (value: UpdateProgress) => void) {
  const channel = new Channel<unknown>();
  channel.onmessage = (value) => {
    if (
      object(value) &&
      Number.isSafeInteger(value.downloaded) &&
      Number.isSafeInteger(value.total) &&
      (value.downloaded as number) >= 0 &&
      (value.total as number) > 0 &&
      (value.total as number) <= 256 * 1024 * 1024 &&
      (value.downloaded as number) <= (value.total as number)
    )
      progress(value as unknown as UpdateProgress);
  };
  return status(await invoke('download_update', { onEvent: channel }));
}
export const cancelUpdate = () => invoke<void>('cancel_update');
export const installUpdate = () => invoke<void>('install_update');
export const clearUpdateCache = () => invoke<void>('clear_update_cache');
export const clearLogs = () => invoke<void>('clear_logs');
export interface UpdateNetwork {
  config: { mode: 'system' | 'manual' | 'pac'; address: string };
  source: string;
}
function network(value: unknown): UpdateNetwork {
  if (
    !object(value) ||
    !object(value.config) ||
    !['system', 'manual', 'pac'].includes(String(value.config.mode)) ||
    typeof value.config.address !== 'string' ||
    value.config.address.length > 2048 ||
    typeof value.source !== 'string' ||
    value.source.length > 40
  )
    throw new Error('update_proxy_invalid');
  return value as unknown as UpdateNetwork;
}
export async function updateNetwork() {
  return network(await invoke('update_network_settings'));
}
export async function saveUpdateNetwork(config: UpdateNetwork['config']) {
  return network(await invoke('save_update_network', { config }));
}
export async function readLogs(): Promise<LogFile[]> {
  const value: unknown = await invoke('read_logs');
  if (
    !Array.isArray(value) ||
    value.length > 2 ||
    !value.every(
      (file) =>
        object(file) &&
        ['workbench.log', 'workbench.1.log'].includes(String(file.name)) &&
        typeof file.text === 'string' &&
        file.text.length <= 2 * 1024 * 1024 &&
        typeof file.bytes === 'number' &&
        file.bytes >= 0 &&
        file.bytes <= 2 * 1024 * 1024,
    )
  )
    throw new Error('logs_unavailable');
  return value;
}
