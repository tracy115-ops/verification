// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { createPersonalShadow } from './personal-shadow';
import { migrateConversations, previewConversationMigration } from './conversation-migration';
import { CONVERSATION_STORE_MODE } from './conversation-storage';
import { CONVERSATIONS_KEY } from './conversation-repository';
import { createSession } from '../domain/runtime/chat';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock('./personal-shadow', () => ({ createPersonalShadow: vi.fn() }));
const missing = { schemaVersion: 1, revision: 0, payload: null };
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify([createSession('codex-native')]));
  vi.mocked(invoke).mockResolvedValue(missing);
  vi.mocked(createPersonalShadow).mockResolvedValue({ schemaVersion: 1, snapshots: [] });
});
it('protects the source before initializing and preserves the browser copy', async () => {
  const preview = await previewConversationMigration();
  vi.mocked(invoke).mockImplementation(async (command) =>
    command === 'write_conversation_store' ? 1 : missing,
  );
  await migrateConversations(preview, () => true);
  expect(createPersonalShadow).toHaveBeenCalledOnce();
  expect(invoke).toHaveBeenLastCalledWith('write_conversation_store', {
    payload: preview.source,
    expectedRevision: 0,
  });
  expect(localStorage.getItem(CONVERSATION_STORE_MODE)).toBe('sqlite-v1');
  expect(localStorage.getItem(CONVERSATIONS_KEY)).toBe(preview.source);
});
it('attaches an existing verified database without replacing its data', async () => {
  const existing = { schemaVersion: 1, revision: 4, payload: '[]' };
  vi.mocked(invoke).mockResolvedValue(existing);
  const preview = await previewConversationMigration();
  await migrateConversations(preview, () => true);
  expect(vi.mocked(invoke).mock.calls.every(([command]) => command === 'read_conversation_store')).toBe(true);
  expect(localStorage.getItem(CONVERSATION_STORE_MODE)).toBe('sqlite-v1');
});
it('does not switch or write if protection fails, data changes, or the owner leaves', async () => {
  const preview = await previewConversationMigration();
  vi.mocked(createPersonalShadow).mockRejectedValueOnce(new Error('shadow_unavailable'));
  await expect(migrateConversations(preview, () => true)).rejects.toThrow('shadow_unavailable');
  vi.mocked(createPersonalShadow).mockImplementationOnce(async () => {
    localStorage.setItem(CONVERSATIONS_KEY, '[]');
    return { schemaVersion: 1, snapshots: [] };
  });
  await expect(migrateConversations(preview, () => true)).rejects.toThrow('store_source_changed');
  await expect(migrateConversations(preview, () => false)).rejects.toThrow('data_restore_blocked');
  expect(localStorage.getItem(CONVERSATION_STORE_MODE)).toBeNull();
  expect(invoke).toHaveBeenCalledOnce();
});
it('rejects a database changed since preview and an invalid native payload', async () => {
  const preview = await previewConversationMigration();
  vi.mocked(invoke).mockResolvedValue({ schemaVersion: 1, revision: 1, payload: '[]' });
  await expect(migrateConversations(preview, () => true)).rejects.toThrow('store_conflict');
  vi.mocked(invoke).mockResolvedValue({ schemaVersion: 1, revision: 2, payload: '[{}]' });
  await expect(previewConversationMigration()).rejects.toThrow('session_storage_invalid');
  expect(localStorage.getItem(CONVERSATION_STORE_MODE)).toBeNull();
});
