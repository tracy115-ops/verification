// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { invoke } from '@tauri-apps/api/core';
import * as backup from './personal-backup';
import { createPersonalShadow, decodeShadowStatus, exportPersonalShadow } from './personal-shadow';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const snapshot = {
  id: 1,
  createdAt: '2026-11-08T00:00:00Z',
  sha256: 'a'.repeat(64),
  bytes: 123,
  sessions: 0,
  transcripts: 0,
};

it('rejects malformed, duplicate, unordered and oversized native snapshot metadata', () => {
  expect(decodeShadowStatus({ schemaVersion: 1, snapshots: [snapshot] }).snapshots).toHaveLength(1);
  for (const value of [
    null,
    {},
    { schemaVersion: 2, snapshots: [] },
    { schemaVersion: 1, snapshots: [snapshot, snapshot] },
    { schemaVersion: 1, snapshots: [{ ...snapshot, createdAt: 'bad' }] },
    { schemaVersion: 1, snapshots: [{ ...snapshot, bytes: 21 * 1024 * 1024 }] },
  ]) {
    expect(() => decodeShadowStatus(value)).toThrow('shadow_invalid');
  }
});

it('verifies the exact UTF-8 snapshot bytes returned by native persistence', async () => {
  const text = JSON.stringify(backup.emptyPersonalData());
  vi.spyOn(backup, 'exportPersonalData').mockResolvedValue(text);
  vi.mocked(invoke).mockImplementation(async (_command, args) => {
    const payload = (args as { payload: string }).payload;
    expect(payload).toBe(text);
    const bytes = new TextEncoder().encode(payload);
    const hash = Buffer.from(await webcrypto.subtle.digest('SHA-256', bytes)).toString('hex');
    return { schemaVersion: 1, snapshots: [{ ...snapshot, sha256: hash, bytes: bytes.length }] } as never;
  });
  const saved = await createPersonalShadow();
  expect(saved.schemaVersion).toBe(1);
  vi.mocked(invoke).mockResolvedValue(text);
  await expect(exportPersonalShadow(saved.snapshots[0])).resolves.toBe(text);
  await expect(exportPersonalShadow({ ...saved.snapshots[0], sha256: 'b'.repeat(64) })).rejects.toThrow(
    'shadow_invalid',
  );
  vi.mocked(invoke).mockResolvedValue({ schemaVersion: 1, snapshots: [snapshot] });
  await expect(createPersonalShadow()).rejects.toThrow('shadow_invalid');
});

it('rejects source changes during collection before requesting a native write', async () => {
  vi.mocked(invoke).mockClear();
  const saved = backup.emptyPersonalData();
  vi.spyOn(backup, 'exportPersonalData').mockImplementation(async () => {
    localStorage.setItem('verification-workbench.conversations.v1', '[]');
    return JSON.stringify(saved);
  });
  await expect(createPersonalShadow()).rejects.toThrow('shadow_source_changed');
  expect(invoke).not.toHaveBeenCalled();
});
