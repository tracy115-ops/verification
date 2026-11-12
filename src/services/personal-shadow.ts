import { invoke } from '@tauri-apps/api/core';
import { exportPersonalData, parseBackup, personalStorageItem } from './personal-backup';

export interface ShadowSnapshot {
  id: number;
  createdAt: string;
  sha256: string;
  bytes: number;
  sessions: number;
  transcripts: number;
}
export interface ShadowStatus {
  schemaVersion: 1;
  snapshots: ShadowSnapshot[];
}

export function decodeShadowStatus(value: unknown): ShadowStatus {
  const v = value as Partial<ShadowStatus> | null;
  if (!v || v.schemaVersion !== 1 || !Array.isArray(v.snapshots) || v.snapshots.length > 2)
    throw new Error('shadow_invalid');
  let previous = Number.MAX_SAFE_INTEGER;
  for (const item of v.snapshots) {
    if (
      !item ||
      !Number.isSafeInteger(item.id) ||
      item.id < 1 ||
      item.id >= previous ||
      typeof item.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(item.createdAt)) ||
      typeof item.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(item.sha256) ||
      !Number.isSafeInteger(item.bytes) ||
      item.bytes < 1 ||
      item.bytes > 20 * 1024 * 1024 ||
      !Number.isSafeInteger(item.sessions) ||
      item.sessions < 0 ||
      !Number.isSafeInteger(item.transcripts) ||
      item.transcripts < 0 ||
      item.transcripts > 2000
    )
      throw new Error('shadow_invalid');
    previous = item.id;
  }
  return value as ShadowStatus;
}
export async function readPersonalShadow() {
  return decodeShadowStatus(await invoke('personal_shadow_status'));
}
async function digest(bytes: Uint8Array<ArrayBuffer>) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function exportPersonalShadow(snapshot: ShadowSnapshot): Promise<string> {
  const payload: unknown = await invoke('export_personal_shadow', { snapshotId: snapshot.id });
  if (typeof payload !== 'string') throw new Error('shadow_invalid');
  parseBackup(payload);
  const bytes = new TextEncoder().encode(payload);
  if (bytes.length !== snapshot.bytes || (await digest(bytes)) !== snapshot.sha256)
    throw new Error('shadow_invalid');
  return payload;
}
export async function createPersonalShadow() {
  const payload = await exportPersonalData();
  const backup = parseBackup(payload);
  // A navigation or another writer must not silently change the source during collection.
  if (Object.entries(backup.storage).some(([key, text]) => personalStorageItem(key) !== text))
    throw new Error('shadow_source_changed');
  const bytes = new TextEncoder().encode(payload);
  const sha256 = await digest(bytes);
  const result = decodeShadowStatus(await invoke('save_personal_shadow', { payload }));
  if (result.snapshots[0]?.sha256 !== sha256 || result.snapshots[0]?.bytes !== bytes.length)
    throw new Error('shadow_invalid');
  return result;
}
