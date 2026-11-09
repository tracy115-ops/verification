import { expect, it } from 'vitest';
import { createDocument } from '../domain/document';
import { browserRepository, decodeWorkflowLibrary, DOCUMENT_KEY } from './repository';
import { emptyPersonalData, validateBackup } from './personal-backup';

function storage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

it('migrates legacy documents without losing workflows, and keeps independent revisions', () => {
  const legacy = { ...createDocument(), revision: 4 };
  const disk = storage(JSON.stringify(legacy));
  const repo = browserRepository(disk);
  expect(repo.load()).toEqual(legacy);
  expect(JSON.parse(disk.getItem()!)).not.toHaveProperty('libraryVersion');
  const other = structuredClone(legacy);
  other.definition.id = 'smoke-testing';
  other.definition.name = 'Smoke';
  other.revision = 0;
  expect(repo.save(other).revision).toBe(1);
  expect(repo.list()).toHaveLength(2);
  expect(repo.select(legacy.definition.id).revision).toBe(4);
  expect(repo.save(legacy).revision).toBe(5);
  expect(repo.save(legacy).revision).toBe(6);
  expect(repo.select(other.definition.id).revision).toBe(1);
  const historical = structuredClone(repo.load());
  repo.remove(other.definition.id);
  expect(repo.load()?.definition.id).toBe(legacy.definition.id);
  expect(historical?.definition.name).toBe('Smoke');
  repo.remove(legacy.definition.id);
  expect(repo.load()).toBeNull();
  expect(repo.list()).toEqual([]);
});

it('rejects corrupt libraries and preserves all saved workflows on a failed write', () => {
  const doc = createDocument();
  for (const value of [
    { libraryVersion: 2, activeId: doc.definition.id, documents: [doc] },
    { libraryVersion: 1, activeId: 'missing', documents: [doc] },
    { libraryVersion: 1, activeId: doc.definition.id, documents: [doc, doc] },
    { libraryVersion: 1, activeId: '', documents: [], extra: true },
  ])
    expect(() => decodeWorkflowLibrary(value)).toThrow('invalidDocument');
  const disk = storage(JSON.stringify(doc));
  const failed = browserRepository({
    ...disk,
    setItem: () => {
      throw new Error('quota');
    },
  });
  expect(() => failed.save(doc)).toThrow('quota');
  expect(() => failed.remove(doc.definition.id)).toThrow('quota');
  expect(failed.load()).toEqual(doc);
});

it('validates old and multiple-workflow backups through the same backup boundary', () => {
  const backup = emptyPersonalData();
  const disk = storage();
  const repo = browserRepository(disk);
  const doc = createDocument();
  backup.storage[DOCUMENT_KEY] = JSON.stringify(doc);
  expect(validateBackup(backup)).toEqual(backup);
  repo.save(doc);
  repo.save({ ...doc, definition: { ...doc.definition, id: 'smoke-testing' } });
  backup.storage[DOCUMENT_KEY] = disk.getItem();
  expect(
    decodeWorkflowLibrary(JSON.parse(validateBackup(backup).storage[DOCUMENT_KEY]!)).documents,
  ).toHaveLength(2);
});
