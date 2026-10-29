import { expect, it } from 'vitest';
import { emptyPersonalData, parseBackup, validateBackup } from './personal-backup';
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
