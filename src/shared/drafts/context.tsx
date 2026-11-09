import {
  createContext,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { createDraftStore, sameDraft, type DraftSection, type DraftStore } from './store';
import type { MessageKey } from '../i18n/messages';

const Context = createContext<DraftStore | null>(null);
const idle = () => () => {};
export function DraftProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createDraftStore);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useDraftStore() {
  return useContext(Context);
}
export function useDraftCount() {
  const store = useDraftStore();
  return useSyncExternalStore(store?.subscribe ?? idle, store?.count ?? (() => 0));
}

export function useProtectedDraft<T>({
  id,
  initial,
  section,
  title,
  open,
  label,
}: {
  id: string;
  initial: T;
  section: DraftSection;
  title: string;
  open?: () => void;
  label?: MessageKey;
}) {
  const parent = useDraftStore();
  const [local] = useState(createDraftStore);
  const store = parent ?? local;
  const latest = useRef({ initial, section, title, open, label });
  latest.current = { initial, section, title, open, label };
  const entry = useSyncExternalStore(store.subscribe, () => store.find(id));
  const value = entry ? (entry.value as T) : initial;
  function change(action: SetStateAction<T>) {
    const previous = store.find(id);
    if (previous?.busy) return;
    const current = previous ? (previous.value as T) : latest.current.initial;
    const next = typeof action === 'function' ? (action as (value: T) => T)(current) : action;
    const { section, title, open, label } = latest.current;
    store.write({
      id,
      section,
      title,
      open,
      label,
      base: previous?.base ?? latest.current.initial,
      value: next,
    });
  }
  return {
    value,
    change,
    dirty: !!entry,
    saving: !!entry?.busy,
    conflicted: !!entry && !sameDraft(entry.base, initial),
    reset() {
      store.discard(id);
    },
    async persist(task: () => Promise<boolean | void>) {
      if (store.find(id)?.busy) return false;
      const previous = store.find(id);
      const { initial, section, title, open, label } = latest.current;
      store.write(
        previous
          ? { ...previous, busy: true }
          : { id, section, title, open, label, value: initial, base: initial, busy: true },
      );
      try {
        const result = await task();
        if (result !== false) store.discard(id, true);
        return result;
      } finally {
        const pending = store.find(id);
        if (pending) store.write({ ...pending, busy: false });
      }
    },
    current: () => store.find(id)?.value as T | undefined,
  };
}
