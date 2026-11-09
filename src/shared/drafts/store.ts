import type { MessageKey } from '../i18n/messages';
export type DraftSection = 'agents' | 'frameworks' | 'updates' | 'team';
export interface DraftEntry {
  id: string;
  section: DraftSection;
  title: string;
  label?: MessageKey;
  value: unknown;
  base: unknown;
  open?: () => void;
  busy?: boolean;
}

export function sameDraft(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Window-local edits only. Never writes configuration, credentials or shared projects. */
export function createDraftStore() {
  let entries: readonly DraftEntry[] = [];
  const listeners = new Set<() => void>();
  function publish(next: readonly DraftEntry[]) {
    entries = next;
    for (const listener of listeners) listener();
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => entries,
    count: () => entries.length,
    find: (id: string) => entries.find((item) => item.id === id),
    discard(id: string, committed = false) {
      if (!committed && entries.find((item) => item.id === id)?.busy) return;
      publish(entries.filter((item) => item.id !== id));
    },
    write(entry: DraftEntry) {
      if (!entry.busy && sameDraft(entry.value, entry.base)) {
        publish(entries.filter((item) => item.id !== entry.id));
        return;
      }
      publish(
        entries.some((item) => item.id === entry.id)
          ? entries.map((item) => (item.id === entry.id ? entry : item))
          : [...entries, entry],
      );
    },
  };
}
export type DraftStore = ReturnType<typeof createDraftStore>;
