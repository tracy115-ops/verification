import { expect, it, vi, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { discoverCliInstances, pickCliPath } from './cli-instances';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
afterEach(() => vi.resetAllMocks());

it('validates discovered instance paths and drivers at the IPC boundary', async () => {
  const items = [{ driver: 'claude', executablePath: 'D:\\Claude One\\claude.cmd' }];
  vi.mocked(invoke)
    .mockResolvedValueOnce(items)
    .mockResolvedValueOnce([{ driver: 'claude', executablePath: 'relative.cmd' }]);
  expect(await discoverCliInstances()).toEqual(items);
  await expect(discoverCliInstances()).rejects.toThrow('discoveryFailed');
});

it('preserves picker cancellation and rejects non-path responses', async () => {
  vi.mocked(invoke)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce('D:\\Config One')
    .mockResolvedValueOnce('');
  expect(await pickCliPath('executable')).toBeNull();
  expect(await pickCliPath('configuration')).toBe('D:\\Config One');
  await expect(pickCliPath('configuration')).rejects.toThrow('cliPickerFailed');
});
