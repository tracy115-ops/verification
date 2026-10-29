import { decodeConversations, CONVERSATIONS_KEY } from './conversation-repository';
import { DOCUMENT_KEY } from './repository';
import { FRAMEWORKS_KEY, loadFrameworks } from './framework-repository';
import { decodeDocument } from '../domain/document';
import { isCliTurnRecord, type CliTurnRecord } from '../domain/runtime/transcript';
import { IndexedDbTranscripts } from './transcript-repository';
import { transcriptStore } from './transcript-store';

const keys = [CONVERSATIONS_KEY, DOCUMENT_KEY, FRAMEWORKS_KEY] as const;
const limit = 20 * 1024 * 1024;
export interface PersonalBackup {
  formatVersion: 1;
  createdAt: string;
  storage: Record<string, string | null>;
  transcripts: CliTurnRecord[];
}
export function validateBackup(input: unknown): PersonalBackup {
  if (!input || typeof input !== 'object') throw new Error('data_backup_invalid');
  const value = input as Partial<PersonalBackup>;
  if (
    value.formatVersion !== 1 ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !value.storage ||
    Array.isArray(value.storage) ||
    !Array.isArray(value.transcripts)
  )
    throw new Error('data_backup_invalid');
  if (
    Object.keys(value.storage).some((key) => !keys.includes(key as (typeof keys)[number])) ||
    keys.some((key) => !(key in value.storage!))
  )
    throw new Error('data_backup_invalid');
  for (const key of keys)
    if (
      value.storage[key] !== null &&
      (typeof value.storage[key] !== 'string' || value.storage[key]!.length > 2_000_000)
    )
      throw new Error('data_backup_invalid');
  const getItem = (key: string) => value.storage![key] ?? null;
  const sessions = decodeConversations(JSON.parse(getItem(CONVERSATIONS_KEY) ?? '[]'));
  if (getItem(DOCUMENT_KEY)) decodeDocument(JSON.parse(getItem(DOCUMENT_KEY)!));
  loadFrameworks({ getItem });
  if (
    value.transcripts.length > 2000 ||
    !value.transcripts.every(isCliTurnRecord) ||
    new Set(value.transcripts.map((record) => record.id)).size !== value.transcripts.length ||
    value.transcripts.some((record) => !sessions.some((session) => session.id === record.sessionId))
  )
    throw new Error('data_backup_invalid');
  return structuredClone(value as PersonalBackup);
}
export function parseBackup(text: string): PersonalBackup {
  if (new TextEncoder().encode(text).length > limit) throw new Error('data_backup_limit');
  try {
    return validateBackup(JSON.parse(text));
  } catch {
    throw new Error('data_backup_invalid');
  }
}
export async function exportPersonalData(): Promise<string> {
  await transcriptStore.flush();
  const sessions = decodeConversations(JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) ?? '[]'));
  const records = await new IndexedDbTranscripts().readAll();
  const result = JSON.stringify(
    validateBackup({
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      storage: Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
      transcripts: records.filter((record) => sessions.some((session) => session.id === record.sessionId)),
    }),
    null,
    2,
  );
  if (new TextEncoder().encode(result).length > limit) throw new Error('data_backup_limit');
  return result;
}
export async function restorePersonalData(backup: PersonalBackup): Promise<void> {
  const valid = validateBackup(backup);
  await transcriptStore.flush();
  const previous = keys.map((key) => [key, localStorage.getItem(key)] as const);
  try {
    for (const key of keys) {
      const value = valid.storage[key];
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    await new IndexedDbTranscripts().replaceAll(valid.transcripts);
  } catch {
    for (const key of keys) localStorage.removeItem(key);
    for (const [key, value] of previous) if (value !== null) localStorage.setItem(key, value);
    throw new Error('data_restore_failed');
  }
}
export function emptyPersonalData(): PersonalBackup {
  return {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    storage: Object.fromEntries(keys.map((key) => [key, null])),
    transcripts: [],
  };
}
export function personalDataBytes(): number {
  return keys.reduce(
    (total, key) => total + new TextEncoder().encode(localStorage.getItem(key) ?? '').length,
    0,
  );
}
export function downloadText(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
