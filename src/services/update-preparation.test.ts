import { afterEach, expect, it, vi } from 'vitest';
import { createPersonalShadow } from './personal-shadow';
import { installUpdate } from './system-api';
import { installWithRecovery } from './update-preparation';
vi.mock('./personal-shadow', () => ({ createPersonalShadow: vi.fn() }));
vi.mock('./system-api', () => ({ installUpdate: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const copy = {
  id: 4,
  sha256: 'a'.repeat(64),
  createdAt: '2026-11-08T00:00:00Z',
  bytes: 1,
  sessions: 0,
  transcripts: 0,
};

it('hands the exact verified receipt to installation after backup succeeds', async () => {
  const order: string[] = [];
  vi.mocked(createPersonalShadow).mockImplementation(async () => {
    order.push('saved');
    return { schemaVersion: 1, snapshots: [copy] };
  });
  vi.mocked(installUpdate).mockImplementation(async () => {
    order.push('handoff');
  });
  await installWithRecovery(
    new AbortController().signal,
    () => true,
    (stage) => order.push(stage),
  );
  expect(order).toEqual(['backup', 'saved', 'install', 'handoff']);
  expect(installUpdate).toHaveBeenCalledWith({ id: copy.id, sha256: copy.sha256 });
});
it('never hands off when backup fails or does not return a snapshot', async () => {
  vi.mocked(createPersonalShadow).mockRejectedValue(new Error('shadow_unavailable'));
  await expect(
    installWithRecovery(
      new AbortController().signal,
      () => true,
      () => {},
    ),
  ).rejects.toThrow('shadow_unavailable');
  vi.mocked(createPersonalShadow).mockResolvedValue({ schemaVersion: 1, snapshots: [] });
  await expect(
    installWithRecovery(
      new AbortController().signal,
      () => true,
      () => {},
    ),
  ).rejects.toThrow('update_backup_required');
  expect(installUpdate).not.toHaveBeenCalled();
});
it('stops before backup or after a pending backup when cancelled, and rechecks task eligibility', async () => {
  const aborted = new AbortController();
  aborted.abort();
  await expect(
    installWithRecovery(
      aborted.signal,
      () => true,
      () => {},
    ),
  ).rejects.toThrow('update_cancelled');
  expect(createPersonalShadow).not.toHaveBeenCalled();
  const later = new AbortController();
  vi.mocked(createPersonalShadow).mockImplementation(async () => {
    later.abort();
    return { schemaVersion: 1, snapshots: [copy] };
  });
  await expect(
    installWithRecovery(
      later.signal,
      () => true,
      () => {},
    ),
  ).rejects.toThrow('update_cancelled');
  vi.mocked(createPersonalShadow).mockResolvedValue({ schemaVersion: 1, snapshots: [copy] });
  await expect(
    installWithRecovery(
      new AbortController().signal,
      () => false,
      () => {},
    ),
  ).rejects.toThrow('update_tasks_running');
  expect(installUpdate).not.toHaveBeenCalled();
});
