// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => true }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
});

it('does not silently replace a failed or missing enabled store with browser data', async () => {
  const module = await import('./conversation-storage');
  localStorage.setItem(module.CONVERSATION_STORE_MODE, 'sqlite-v1');
  vi.mocked(invoke).mockRejectedValueOnce(new Error('store_corrupt'));
  await expect(module.bootConversationStorage()).rejects.toThrow('store_corrupt');
  vi.mocked(invoke).mockResolvedValueOnce({ schemaVersion: 1, revision: 0, payload: null });
  await expect(module.bootConversationStorage()).rejects.toThrow('store_missing');
  expect(module.conversationStorageState().phase).toBe('browser');
  vi.mocked(invoke).mockResolvedValueOnce({ schemaVersion: 1, revision: 3, payload: '[]' });
  await module.bootConversationStorage();
  expect(module.conversationStorageState()).toEqual({ revision: 3, phase: 'saved', error: null });
  expect(localStorage.getItem(module.CONVERSATION_STORE_MODE)).toBe('sqlite-v1');
});
it('does not interpret a future activation marker as legacy browser mode', async () => {
  const module = await import('./conversation-storage');
  localStorage.setItem(module.CONVERSATION_STORE_MODE, 'sqlite-v2');
  expect(module.requiresConversationBoot()).toBe(true);
  await expect(module.bootConversationStorage()).rejects.toThrow('store_version');
  expect(invoke).not.toHaveBeenCalled();
});
it('rejects invalid revision receipts and malformed snapshots', async () => {
  const module = await import('./conversation-storage');
  for (const value of [
    null,
    { schemaVersion: 2, revision: 1, payload: '[]' },
    { schemaVersion: 1, revision: 0, payload: '[]' },
    { schemaVersion: 1, revision: 1, payload: null },
  ])
    expect(() => module.decodeNativeConversationSnapshot(value)).toThrow('store_invalid');
  vi.mocked(invoke).mockResolvedValue(20);
  await expect(module.writeNativeConversations('[]', 1)).rejects.toThrow('store_invalid');
});
