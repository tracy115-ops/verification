import { validateBackup, restorePersonalData, type PersonalBackup } from './personal-backup';
import { createPersonalShadow } from './personal-shadow';
import { CONVERSATIONS_KEY, decodeConversations } from './conversation-repository';
import { DOCUMENT_KEY, decodeWorkflowLibrary } from './repository';
import { FRAMEWORKS_KEY } from './framework-repository';

export function summarizeBackup(backup: PersonalBackup) {
  const sessions = decodeConversations(JSON.parse(backup.storage[CONVERSATIONS_KEY] ?? '[]'));
  return {
    sessions: sessions.length,
    runs: sessions.reduce((count, session) => count + session.runs.length, 0),
    transcripts: backup.transcripts.length,
    workflow: backup.storage[DOCUMENT_KEY]
      ? decodeWorkflowLibrary(JSON.parse(backup.storage[DOCUMENT_KEY]!)).documents.length > 0
      : false,
    frameworks: (JSON.parse(backup.storage[FRAMEWORKS_KEY] || '[]') as unknown[]).length,
  };
}

export async function restoreWithSafetyCopy(
  backup: PersonalBackup,
  mayContinue: () => boolean,
  stage: (value: 'backup' | 'restore') => void,
) {
  const target = validateBackup(backup);
  if (!mayContinue()) throw new Error('data_restore_blocked');
  stage('backup');
  const saved = await createPersonalShadow();
  if (!saved.snapshots.length) throw new Error('shadow_invalid');
  if (!mayContinue()) throw new Error('data_restore_blocked');
  stage('restore');
  await restorePersonalData(target, mayContinue);
}
