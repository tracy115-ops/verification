import { invoke } from '@tauri-apps/api/core';

export interface LanPeer {
  id: string;
  name: string;
  url: string;
}
export interface LanHost {
  version: 1;
  port: number;
  addresses: string[];
  ownerToken: string | null;
  discoverable: boolean;
}
function host(value: unknown): LanHost | null {
  if (value === null) return null;
  const item = value as LanHost;
  if (
    !item ||
    item.version !== 1 ||
    !Number.isInteger(item.port) ||
    !Array.isArray(item.addresses) ||
    !item.addresses.every(
      (address) => typeof address === 'string' && /^http:\/\/[\d.]+:\d+$/.test(address),
    ) ||
    (item.ownerToken !== null && typeof item.ownerToken !== 'string') ||
    typeof item.discoverable !== 'boolean'
  )
    throw new Error('lan_invalid');
  return item;
}
export const lanApi = {
  async status() {
    return host(await invoke('collaboration_status'));
  },
  async start(port: number, name: string) {
    const result = host(await invoke('start_collaboration', { port, name }));
    if (!result) throw new Error('lan_start_failed');
    return result;
  },
  stop: () => invoke<void>('stop_collaboration'),
  async discover(): Promise<LanPeer[]> {
    const result = await invoke<unknown>('discover_collaboration');
    if (
      !Array.isArray(result) ||
      result.length > 32 ||
      result.some(
        (item) =>
          !item ||
          typeof item.id !== 'string' ||
          typeof item.name !== 'string' ||
          typeof item.url !== 'string' ||
          !/^http:\/\/[\d.]+:\d+$/.test(item.url),
      )
    )
      throw new Error('lan_invalid');
    return result;
  },
  open: (url: string) => invoke<void>('open_collaboration', { url }),
};
