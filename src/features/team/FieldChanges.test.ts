import { expect, it } from 'vitest';
import { changedFields } from './FieldChanges';

it('shows added, changed and removed fields without unchanged object order noise', () => {
  expect(
    changedFields(
      { title: 'old', nested: { a: 1, b: 2 }, removed: 'value' },
      { title: 'new', nested: { b: 2, a: 1 }, added: ['x'] },
    ).map((item) => item.key),
  ).toEqual(['title', 'removed', 'added']);
  expect(changedFields(null, { title: 'new' })).toHaveLength(1);
});
