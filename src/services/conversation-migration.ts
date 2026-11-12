import { createPersonalShadow } from './personal-shadow';
import {
  browserConversationSource,
  CONVERSATION_STORE_MODE,
  readNativeConversations,
  requiresConversationBoot,
  validateConversationPayload,
  writeNativeConversations,
  type NativeConversationSnapshot,
} from './conversation-storage';

export interface ConversationMigrationPreview {
  source: string;
  target: NativeConversationSnapshot;
}
export async function previewConversationMigration(): Promise<ConversationMigrationPreview> {
  const source = browserConversationSource();
  validateConversationPayload(source);
  const target = await readNativeConversations();
  if (browserConversationSource() !== source) throw new Error('store_source_changed');
  return { source, target };
}
export async function migrateConversations(
  preview: ConversationMigrationPreview,
  mayContinue: () => boolean,
) {
  function check() {
    if (!mayContinue() || requiresConversationBoot()) throw new Error('data_restore_blocked');
    if (browserConversationSource() !== preview.source) throw new Error('store_source_changed');
  }
  check();
  await createPersonalShadow();
  check();
  const current = await readNativeConversations();
  check();
  if (current.revision !== preview.target.revision || current.payload !== preview.target.payload)
    throw new Error('store_conflict');
  if (current.payload === null) await writeNativeConversations(preview.source, 0);
  check();
  // The browser source remains intact. Existing databases are attached, never overwritten here.
  localStorage.setItem(CONVERSATION_STORE_MODE, 'sqlite-v1');
}
