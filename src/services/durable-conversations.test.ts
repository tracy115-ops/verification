import { expect, it, vi } from 'vitest';
import { DurableConversations } from './durable-conversations';
import { CONVERSATIONS_KEY as key } from './conversation-repository';

it('serializes commits and retains the latest change arriving during an acknowledgement', async () => {
  let acknowledge!: (revision: number) => void;
  const commit = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          acknowledge = resolve;
        }),
    )
    .mockResolvedValueOnce(3);
  const store = new DurableConversations('[]', 1, commit);
  store.setItem(key, '[1]');
  await vi.waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
  store.setItem(key, '[2]');
  store.setItem(key, '[3]');
  expect(store.snapshot().phase).toBe('saving');
  acknowledge(2);
  await store.flush();
  expect(commit.mock.calls).toEqual([
    ['[1]', 1],
    ['[3]', 2],
  ]);
  expect(store.getItem(key)).toBe('[3]');
  expect(store.snapshot()).toEqual({ revision: 3, phase: 'saved', error: null });
});
it('keeps failed data in memory, blocks flush and retries the same expected revision', async () => {
  const commit = vi.fn().mockRejectedValueOnce(new Error('store_unavailable')).mockResolvedValueOnce(8);
  const store = new DurableConversations('[]', 7, commit);
  store.setItem(key, '[1]');
  await expect(store.flush()).rejects.toThrow('store_unavailable');
  store.setItem(key, '[2]');
  expect(store.snapshot().phase).toBe('error');
  expect(store.getItem(key)).toBe('[2]');
  await store.retry();
  expect(commit.mock.calls).toEqual([
    ['[1]', 7],
    ['[2]', 7],
  ]);
  expect(store.snapshot().phase).toBe('saved');
});
it('does not rebase a conflicting writer or report an invalid acknowledgement as saved', async () => {
  for (const result of [Promise.reject(new Error('store_conflict')), Promise.resolve(100)]) {
    const commit = vi.fn(() => result);
    const store = new DurableConversations('[]', 1, commit);
    store.setItem(key, '[1]');
    await expect(store.flush()).rejects.toThrow(/store_(conflict|invalid)/);
    expect(store.snapshot().revision).toBe(1);
    expect(store.snapshot().phase).toBe('error');
    expect(store.getItem(key)).toBe('[1]');
  }
});
it('does not suppress a return to the last committed value while another write is in flight', async () => {
  let acknowledge!: (n: number) => void;
  const commit = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          acknowledge = resolve;
        }),
    )
    .mockResolvedValueOnce(3);
  const store = new DurableConversations('[]', 1, commit);
  store.setItem(key, '[1]');
  await vi.waitFor(() => expect(commit).toHaveBeenCalledOnce());
  store.setItem(key, '[]');
  acknowledge(2);
  await store.flush();
  expect(commit.mock.calls).toEqual([
    ['[1]', 1],
    ['[]', 2],
  ]);
});
