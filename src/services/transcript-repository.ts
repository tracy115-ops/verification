import { isCliTurnRecord, type CliTurnRecord, type TranscriptRepository } from '../domain/runtime/transcript';

const databaseName = 'verification-workbench-transcripts';

export class IndexedDbTranscripts implements TranscriptRepository {
  async readAll(): Promise<CliTurnRecord[]> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const request = db.transaction('turns').objectStore('turns').getAll();
      request.onsuccess = () =>
        request.result.every(isCliTurnRecord)
          ? resolve(request.result)
          : reject(new Error('transcript_invalid'));
      request.onerror = () => reject(new Error('transcript_unavailable'));
    });
  }
  async replaceAll(records: CliTurnRecord[]): Promise<void> {
    if (!records.every(isCliTurnRecord)) throw new Error('transcript_invalid');
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('turns', 'readwrite');
      const store = transaction.objectStore('turns');
      store.clear();
      for (const record of records) store.put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error('transcript_unavailable'));
    });
  }
  private opening?: Promise<IDBDatabase>;
  private database(): Promise<IDBDatabase> {
    return (this.opening ??= new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('transcript_unavailable'));
        return;
      }
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('turns', { keyPath: 'id' }).createIndex('session', 'sessionId');
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.opening = undefined;
        };
        resolve(db);
      };
      request.onerror = () => {
        this.opening = undefined;
        reject(new Error('transcript_unavailable'));
      };
      request.onblocked = () => {
        this.opening = undefined;
        reject(new Error('transcript_unavailable'));
      };
    }));
  }
  async readSession(sessionId: string): Promise<CliTurnRecord[]> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction('turns', 'readonly')
        .objectStore('turns')
        .index('session')
        .getAll(sessionId);
      request.onsuccess = () =>
        Array.isArray(request.result) && request.result.every(isCliTurnRecord)
          ? resolve(request.result)
          : reject(new Error('transcript_invalid'));
      request.onerror = () => reject(new Error('transcript_unavailable'));
    });
  }
  async save(record: CliTurnRecord): Promise<void> {
    if (!isCliTurnRecord(record)) throw new Error('transcript_invalid');
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('turns', 'readwrite');
      transaction.objectStore('turns').put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error('transcript_unavailable'));
    });
  }
  async removeSession(sessionId: string): Promise<void> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('turns', 'readwrite');
      const request = transaction.objectStore('turns').index('session').openCursor(sessionId);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error('transcript_unavailable'));
    });
  }
}
