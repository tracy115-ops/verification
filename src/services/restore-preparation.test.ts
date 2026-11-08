// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import * as backup from './personal-backup';
import { createPersonalShadow } from './personal-shadow';
import { restoreWithSafetyCopy, summarizeBackup } from './restore-preparation';
import { createSession } from '../domain/runtime/chat';
import { CONVERSATIONS_KEY } from './conversation-repository';
import { FRAMEWORKS_KEY } from './framework-repository';
vi.mock('./personal-shadow', () => ({ createPersonalShadow: vi.fn() }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(createPersonalShadow).mockReset();
});
const snapshots = [
  { id: 1, sha256: 'a'.repeat(64), createdAt: '2026-11-08T00:00:00Z', bytes: 1, sessions: 0, transcripts: 0 },
];

it('summarizes saved data without counting default frameworks as saved configuration', () => {
  const target = backup.emptyPersonalData();
  target.storage[CONVERSATIONS_KEY] = JSON.stringify([createSession('codeagent-native')]);
  target.storage[FRAMEWORKS_KEY] = '';
  expect(summarizeBackup(target)).toEqual({
    sessions: 1,
    runs: 0,
    transcripts: 0,
    workflow: false,
    frameworks: 0,
  });
});
it('validates the target and saves current data before restoring the captured target', async () => {
  const target = backup.emptyPersonalData();
  const order: string[] = [];
  vi.mocked(createPersonalShadow).mockImplementation(async () => {
    order.push('saved');
    return { schemaVersion: 1, snapshots };
  });
  const restore = vi.spyOn(backup, 'restorePersonalData').mockImplementation(async () => {
    order.push('written');
  });
  await restoreWithSafetyCopy(
    target,
    () => true,
    (stage) => order.push(stage),
  );
  expect(order).toEqual(['backup', 'saved', 'restore', 'written']);
  expect(restore).toHaveBeenCalledWith(target, expect.any(Function));
  expect(restore.mock.calls[0][0]).not.toBe(target);
});
it('does not restore invalid targets, failed safety copies, or after task/page eligibility changes', async () => {
  const restore = vi.spyOn(backup, 'restorePersonalData').mockResolvedValue();
  await expect(
    restoreWithSafetyCopy(
      { ...backup.emptyPersonalData(), formatVersion: 2 } as never,
      () => true,
      () => {},
    ),
  ).rejects.toThrow();
  expect(createPersonalShadow).not.toHaveBeenCalled();
  vi.mocked(createPersonalShadow).mockRejectedValue(new Error('shadow_unavailable'));
  await expect(
    restoreWithSafetyCopy(
      backup.emptyPersonalData(),
      () => true,
      () => {},
    ),
  ).rejects.toThrow('shadow_unavailable');
  let allowed = true;
  vi.mocked(createPersonalShadow).mockImplementation(async () => {
    allowed = false;
    return { schemaVersion: 1, snapshots };
  });
  await expect(
    restoreWithSafetyCopy(
      backup.emptyPersonalData(),
      () => allowed,
      () => {},
    ),
  ).rejects.toThrow('data_restore_blocked');
  expect(restore).not.toHaveBeenCalled();
});
