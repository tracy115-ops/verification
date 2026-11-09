import { decodeDocument } from '../domain/document';
import { checkDocument, type WorkbenchDocument } from '../domain/workflow';

export const DOCUMENT_KEY = 'verification-workbench.document.v1';
export interface DraftRepository {
  load(): WorkbenchDocument | null;
  list(): WorkbenchDocument[];
  select(id: string): WorkbenchDocument;
  remove(id: string): WorkbenchDocument | null;
  save(document: WorkbenchDocument): WorkbenchDocument;
}

interface WorkflowLibrary {
  libraryVersion: 1;
  activeId: string;
  documents: WorkbenchDocument[];
}

// The original key remains the atomic persistence/backup boundary. Old single
// documents are read without rewriting them until the next successful mutation.
export function decodeWorkflowLibrary(value: unknown): WorkflowLibrary {
  if (value && typeof value === 'object' && 'libraryVersion' in value) {
    const input = value as WorkflowLibrary;
    if (
      input.libraryVersion !== 1 ||
      Object.keys(input).some((key) => !['libraryVersion', 'activeId', 'documents'].includes(key)) ||
      !Array.isArray(input.documents) ||
      input.documents.length > 100 ||
      typeof input.activeId !== 'string'
    )
      throw new Error('invalidDocument');
    const documents = input.documents.map(decodeDocument);
    const ids = new Set(documents.map((item) => item.definition.id));
    if (
      ids.size !== documents.length ||
      (documents.length ? !ids.has(input.activeId) : input.activeId !== '')
    )
      throw new Error('invalidDocument');
    return { libraryVersion: 1, activeId: input.activeId, documents };
  }
  const document = decodeDocument(value);
  return { libraryVersion: 1, activeId: document.definition.id, documents: [document] };
}

export function browserRepository(storage: Pick<Storage, 'getItem' | 'setItem'>): DraftRepository {
  const read = (): WorkflowLibrary => {
    const text = storage.getItem(DOCUMENT_KEY);
    return text
      ? decodeWorkflowLibrary(JSON.parse(text))
      : { libraryVersion: 1, activeId: '', documents: [] };
  };
  const write = (library: WorkflowLibrary) => {
    const text = JSON.stringify(library);
    if (text.length > 2_000_000) throw new Error('invalidDocument');
    storage.setItem(DOCUMENT_KEY, text);
  };
  return {
    load() {
      const library = read();
      return library.documents.find((item) => item.definition.id === library.activeId) ?? null;
    },
    list: () => read().documents,
    select(id) {
      const library = read();
      const document = library.documents.find((item) => item.definition.id === id);
      if (!document) throw new Error('invalidDocument');
      write({ ...library, activeId: id });
      return document;
    },
    remove(id) {
      const library = read();
      const documents = library.documents.filter((item) => item.definition.id !== id);
      const activeId = library.activeId === id ? (documents[0]?.definition.id ?? '') : library.activeId;
      write({ ...library, activeId, documents });
      return documents.find((item) => item.definition.id === activeId) ?? null;
    },
    save(document) {
      if (checkDocument(document).length) throw new Error('invalidDocument');
      const library = read();
      const previous = library.documents.find((item) => item.definition.id === document.definition.id);
      const snapshot = decodeDocument({
        ...document,
        revision: Math.max(document.revision, previous?.revision ?? 0) + 1,
      });
      const documents = previous
        ? library.documents.map((item) => (item.definition.id === snapshot.definition.id ? snapshot : item))
        : [...library.documents, snapshot];
      if (documents.length > 100) throw new Error('invalidDocument');
      write({ libraryVersion: 1, activeId: snapshot.definition.id, documents });
      return snapshot;
    },
  };
}
