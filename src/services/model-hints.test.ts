import { expect, it, vi, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { createDocument } from '../domain/document';
import { readModelHints } from './model-hints';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
afterEach(() => vi.resetAllMocks());
it('accepts safe candidate fields and rejects malformed IPC responses', async () => {
  const profile = createDocument().profiles[0];
  vi.mocked(invoke).mockResolvedValueOnce({
    status: 'found',
    candidates: [{ model: 'fixture', source: 'config.toml' }],
  });
  expect((await readModelHints(profile)).candidates[0].model).toBe('fixture');
  vi.mocked(invoke).mockResolvedValueOnce({
    status: 'found',
    candidates: [{ model: '\ninvalid', source: '' }],
  });
  await expect(readModelHints(profile)).rejects.toThrow('cliModelReadFailed');
});
