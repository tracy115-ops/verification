import { expect, it } from 'vitest';
import { newId } from './id';
it('creates RFC 4122 version 4 identifiers without secure-context randomUUID', () => {
  const id = newId({ getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
  expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  expect(new Set(Array.from({ length: 100 }, () => newId())).size).toBe(100);
});
