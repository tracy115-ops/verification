import { decodeDocument } from '../domain/document';
import { checkDocument, type WorkbenchDocument } from '../domain/workflow';

export const DOCUMENT_KEY = 'verification-workbench.document.v1';
export interface DraftRepository {
  load(): WorkbenchDocument | null;
  save(document: WorkbenchDocument): WorkbenchDocument;
}

export function browserRepository(storage: Pick<Storage, 'getItem' | 'setItem'>): DraftRepository {
  return {
    load() {
      const text = storage.getItem(DOCUMENT_KEY);
      return text ? decodeDocument(JSON.parse(text)) : null;
    },
    save(document) {
      if (checkDocument(document).length) throw new Error('invalidDocument');
      const snapshot = decodeDocument({ ...document, revision: document.revision + 1 });
      storage.setItem(DOCUMENT_KEY, JSON.stringify(snapshot));
      return snapshot;
    },
  };
}
