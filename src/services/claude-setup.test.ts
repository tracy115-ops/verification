import { expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { inspectClaudeSetup } from './claude-setup';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
it('validates source-presence flags without accepting credential-shaped values', async () => {
  const safe = {
    configDirectory: 'D:\\Config',
    environmentAuth: false,
    settingsAuth: false,
    loginFilePresent: false,
    keyHelperPresent: false,
    endpointPresent: false,
  };
  vi.mocked(invoke)
    .mockResolvedValueOnce(safe)
    .mockResolvedValueOnce({ ...safe, environmentAuth: 'secret' });
  expect(await inspectClaudeSetup('D:\\Config')).toEqual(safe);
  await expect(inspectClaudeSetup()).rejects.toThrow('cliSetupInspectFailed');
});
