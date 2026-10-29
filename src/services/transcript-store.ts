import type { CliTurnRecord, TranscriptRepository } from '../domain/runtime/transcript';
import { IndexedDbTranscripts } from './transcript-repository';

export class TranscriptStore {
  private listeners = new Set<() => void>();
  private records = new Map<string, CliTurnRecord>();
  private pending = new Map<string, ReturnType<typeof setTimeout>>();
  private deleted = new Set<string>();
  private snapshot = { records: [] as CliTurnRecord[], error: null as string | null };
  constructor(private repository: TranscriptRepository) {}
  async flush(): Promise<void> {
    for (const timer of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
    for (const record of this.records.values())
      if (!this.deleted.has(record.sessionId)) await this.repository.save(structuredClone(record));
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private emit(error = this.snapshot.error) {
    this.snapshot = { records: [...this.records.values()], error };
    for (const listener of this.listeners) listener();
  }
  private async persist(record: CliTurnRecord) {
    try {
      await this.repository.save(structuredClone(record));
    } catch {
      this.emit('transcript_unavailable');
    }
  }
  async load(sessionId: string) {
    try {
      const records = await this.repository.readSession(sessionId);
      if (this.deleted.has(sessionId)) return;
      for (const record of records)
        if (!this.records.has(record.id))
          this.records.set(
            record.id,
            record.status === 'running' ? { ...record, status: 'interrupted' } : record,
          );
      this.emit();
    } catch {
      this.emit('transcript_unavailable');
    }
  }
  save(record: CliTurnRecord, immediately = false) {
    if (this.deleted.has(record.sessionId)) return;
    this.records.set(record.id, structuredClone(record));
    const timer = this.pending.get(record.id);
    if (immediately) {
      if (timer) clearTimeout(timer);
      this.pending.delete(record.id);
      void this.persist(record);
      this.emit();
    } else if (!timer)
      this.pending.set(
        record.id,
        setTimeout(() => {
          this.pending.delete(record.id);
          const current = this.records.get(record.id);
          if (current) {
            void this.persist(current);
            this.emit();
          }
        }, 250),
      );
  }
  validation(id: string, error: string) {
    const record = this.records.get(id);
    if (record?.status === 'completed' && !record.validationError)
      this.save({ ...record, validationError: error }, true);
  }
  async removeSession(id: string) {
    this.deleted.add(id);
    for (const [key, record] of this.records)
      if (record.sessionId === id) {
        const timer = this.pending.get(key);
        if (timer) clearTimeout(timer);
        this.pending.delete(key);
        this.records.delete(key);
      }
    this.emit();
    try {
      await this.repository.removeSession(id);
    } catch {
      this.emit('transcript_delete_failed');
    }
  }
}

export const transcriptStore = new TranscriptStore(new IndexedDbTranscripts());
