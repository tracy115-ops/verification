import type { useConversationStore } from './useConversationStore';
import { transcriptStore } from '../services/transcript-store';

export function sessionActions(
  store: ReturnType<typeof useConversationStore>,
  locked: () => boolean,
  resetRun: () => void,
) {
  return {
    renameSession(id: string, title: string) {
      return !locked() && store.renameSession(id, title);
    },
    deleteSession(id: string) {
      if (locked() || !store.deleteSession(id)) return false;
      if (id === store.activeId) resetRun();
      void transcriptStore.removeSession(id);
      return true;
    },
  };
}
