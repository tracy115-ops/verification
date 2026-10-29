// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { emptyPersonalData, parseBackup, restorePersonalData, validateBackup } from './personal-backup';
import { IndexedDbTranscripts } from './transcript-repository';
import { DOCUMENT_KEY } from './repository';
import { CONVERSATIONS_KEY } from './conversation-repository';
import { createSession } from '../domain/runtime/chat';

it('rejects unsupported formats, auth storage and malformed business records before restoration', () => {
  const value = emptyPersonalData();
  expect(parseBackup(JSON.stringify(value))).toEqual(value);
  expect(() => validateBackup({ ...value, formatVersion: 2 })).toThrow();
  expect(() => validateBackup({ ...value, storage: { ...value.storage, 'team.token': 'secret' } })).toThrow();
  expect(() =>
    validateBackup({ ...value, storage: { ...value.storage, [CONVERSATIONS_KEY]: '{"not":"sessions"}' } }),
  ).toThrow();
  expect(() => parseBackup('x'.repeat(21 * 1024 * 1024))).toThrow('data_backup_limit');
});
it('validates conversations and rejects orphaned or duplicate CLI records', () => {
  const session = createSession('codeagent-native');
  const value = emptyPersonalData();
  value.storage[CONVERSATIONS_KEY] = JSON.stringify([session]);
  expect(validateBackup(value).storage[CONVERSATIONS_KEY]).toContain(session.id);
  expect(() => validateBackup({ ...value, transcripts: [{ version: 1, id: 'orphan' }] })).toThrow();
});

it('restores existing business data when replacing transcript storage fails', async () => {
  const original = JSON.stringify([createSession('codeagent-native')]);
  localStorage.setItem(CONVERSATIONS_KEY, original);
  localStorage.removeItem(DOCUMENT_KEY);
  const replacement = vi
    .spyOn(IndexedDbTranscripts.prototype, 'replaceAll')
    .mockRejectedValue(new Error('disk_failed'));
  try {
    await expect(restorePersonalData(emptyPersonalData())).rejects.toThrow('data_restore_failed');
    expect(localStorage.getItem(CONVERSATIONS_KEY)).toBe(original);
    expect(localStorage.getItem(DOCUMENT_KEY)).toBeNull();
  } finally {
    replacement.mockRestore();
    localStorage.clear();
  }
});
