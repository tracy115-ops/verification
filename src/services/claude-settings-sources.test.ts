import { afterEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { discoverClaudeSettings } from './claude-settings-sources';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
afterEach(() => vi.resetAllMocks());
it('accepts configuration metadata and sends the selected directory without reading secrets', async () => {
  const source = {
    path: 'D:\\Config\\settings.json.bak',
    model: 'fixture',
    backup: true,
    authenticationFields: true,
  };
  vi.mocked(invoke).mockResolvedValueOnce([source]);
  expect(await discoverClaudeSettings('D:\\Config')).toEqual([source]);
  expect(invoke).toHaveBeenCalledWith('discover_claude_settings', { configDirectory: 'D:\\Config' });
});
it('rejects untrusted paths and malformed metadata', async () => {
  for (const response of [
    null,
    [{ path: 'relative.json', model: null, backup: true, authenticationFields: true }],
    [{ path: 'D:\\settings.json', model: null, backup: 'yes', authenticationFields: true }],
  ]) {
    vi.mocked(invoke).mockResolvedValueOnce(response);
    await expect(discoverClaudeSettings()).rejects.toThrow('cliSetupInspectFailed');
  }
});
