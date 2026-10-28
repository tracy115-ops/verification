import type { FrameworkProfile } from '../domain/execution/types';
import { decodeFramework } from '../domain/execution/validation';
import { exampleFramework } from '../domain/execution/presets';

export const FRAMEWORKS_KEY = 'verification-workbench.frameworks.v1';
export function loadFrameworks(storage: Pick<Storage, 'getItem'>): FrameworkProfile[] {
  const text = storage.getItem(FRAMEWORKS_KEY);
  if (!text) return [exampleFramework()];
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value) || value.length > 30) throw new Error('execution_invalid');
  const profiles = value.map(decodeFramework);
  if (new Set(profiles.map((profile) => profile.id)).size !== profiles.length)
    throw new Error('execution_invalid');
  return profiles;
}
export function saveFrameworks(storage: Pick<Storage, 'setItem'>, profiles: FrameworkProfile[]): void {
  if (profiles.length > 30 || new Set(profiles.map((profile) => profile.id)).size !== profiles.length)
    throw new Error('execution_invalid');
  const valid = profiles.map(decodeFramework);
  storage.setItem(FRAMEWORKS_KEY, JSON.stringify(valid));
}
