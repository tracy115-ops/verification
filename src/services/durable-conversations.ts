import { CONVERSATIONS_KEY } from './conversation-repository';

export interface ConversationStorageState {
  revision: number;
  phase: 'saved' | 'saving' | 'error';
  error: string | null;
}
/** A synchronous UI cache with serialized, acknowledged SQLite commits. */
export class DurableConversations {
  private value: string;
  private committed: string;
  private pending: string | null = null;
  private worker: Promise<void> | null = null;
  private state: ConversationStorageState;
  private listeners = new Set<() => void>();
  constructor(
    payload: string,
    revision: number,
    private commit: (text: string, revision: number) => Promise<number>,
  ) {
    this.value = this.committed = payload;
    this.state = { revision, phase: 'saved', error: null };
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.state;
  private publish(patch: Partial<ConversationStorageState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  getItem(key: string) {
    if (key !== CONVERSATIONS_KEY) throw new Error('store_invalid');
    return this.value;
  }
  setItem(key: string, text: string) {
    if (key !== CONVERSATIONS_KEY || text.length > 2_000_000) throw new Error('store_invalid');
    if (this.value === text) return;
    this.value = text;
    this.pending = text;
    if (!this.state.error) this.start();
  }
  removeItem(key: string) {
    this.setItem(key, '[]');
  }
  private start() {
    if (this.worker || this.pending === null || this.state.error) return;
    this.publish({ phase: 'saving' });
    this.worker = Promise.resolve()
      .then(async () => {
        while (this.pending !== null) {
          const text = this.pending;
          this.pending = null;
          if (text === this.committed) continue;
          try {
            const revision = await this.commit(text, this.state.revision);
            if (!Number.isSafeInteger(revision) || revision !== this.state.revision + 1)
              throw new Error('store_invalid');
            this.committed = text;
            this.publish({ revision });
          } catch (error) {
            const code = error instanceof Error ? error.message : String(error);
            this.pending = this.value;
            this.publish({
              phase: 'error',
              error: /^store_(conflict|corrupt|version|limit|invalid|unavailable)$/.test(code)
                ? code
                : 'store_unavailable',
            });
            return;
          }
        }
      })
      .finally(() => {
        this.worker = null;
        if (!this.state.error) {
          if (this.pending !== null) this.start();
          else this.publish({ phase: 'saved' });
        }
      });
  }
  async flush() {
    while (this.worker) await this.worker;
    if (this.state.error) throw new Error(this.state.error);
  }
  async retry() {
    this.publish({ error: null });
    this.start();
    await this.flush();
  }
}
