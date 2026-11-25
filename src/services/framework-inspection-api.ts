import { Channel, invoke } from '@tauri-apps/api/core';
import { hasDesktopBridge } from './agent-api';
import {
  decodeFrameworkInspection,
  frameworkInspectionState,
  type FrameworkInspection,
} from '../domain/execution/framework-inspection';
import type { FrameworkProfile } from '../domain/execution/types';
import { newId } from '../shared/id';
import { digest } from '../domain/runtime/plan';
import type { Artifact } from '../domain/runtime/types';
import { sha256Text as sourceDigest } from '../shared/sha256';

type Input = Pick<FrameworkProfile, 'pythonCommand' | 'frameworkSource' | 'frameworkModules'>;
export interface InspectionRecord {
  report: FrameworkInspection;
  checkedAt: string;
}
const records = new Map<string, { id: string; record?: InspectionRecord }>();
const listeners = new Set<() => void>();
const keyFor = (input: Input) => JSON.stringify([input.pythonCommand, input.frameworkSource]);
const publish = () => {
  for (const listener of listeners) listener();
};
export function clearFrameworkInspections() {
  records.clear();
  publish();
}
export function subscribeFrameworkInspections(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const getFrameworkInspection = (input: Input) =>
  input.frameworkModules ? undefined : records.get(keyFor(input))?.record;
export function assertFrameworkInspectionAllows(input: Input) {
  if (frameworkInspectionState(getFrameworkInspection(input)?.report) === 'blocked')
    throw new Error('framework_inspection_blocked');
}
export async function frameworkInspectionArtifact(input: Input): Promise<Artifact | undefined> {
  assertFrameworkInspectionAllows(input);
  const record = getFrameworkInspection(input);
  if (!record) return;
  const value = { ...record, pythonCommand: input.pythonCommand };
  return { type: 'FrameworkInspection', value, digest: await digest(value) };
}
export async function inspectFramework(input: Input, signal: AbortSignal): Promise<InspectionRecord> {
  if (!hasDesktopBridge()) throw new Error('desktopRequired');
  if (signal.aborted) throw new Error('execution_cancelled');
  if (
    input.frameworkModules ||
    !input.frameworkSource.trim() ||
    new TextEncoder().encode(input.frameworkSource).length > 60000
  )
    throw new Error('framework_inspection_invalid');
  const id = newId();
  const key = keyFor(input);
  records.delete(key);
  records.set(key, { id });
  if (records.size > 20) records.delete(records.keys().next().value!);
  publish();
  const channel = new Channel<unknown>();
  channel.onmessage = () => {};
  const cancel = () => {
    void invoke('cancel_python', { executionId: id }).catch(() => {});
  };
  const timer = setInterval(() => {
    if (signal.aborted) cancel();
  }, 150);
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const result = await invoke('inspect_framework', {
      request: { id, pythonCommand: input.pythonCommand, source: input.frameworkSource },
      onEvent: channel,
    });
    if (signal.aborted) throw new Error('execution_cancelled');
    const report = decodeFrameworkInspection(result);
    const expectedDigest = await sourceDigest(input.frameworkSource);
    if (signal.aborted) throw new Error('execution_cancelled');
    if (report.sourceSha256 !== expectedDigest || records.get(key)?.id !== id)
      throw new Error('framework_inspection_invalid');
    const record = { report, checkedAt: new Date().toISOString() };
    records.set(key, { id, record });
    publish();
    return record;
  } catch (error) {
    if (records.get(key)?.id === id) records.delete(key);
    publish();
    throw new Error(
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'framework_inspection_failed',
    );
  } finally {
    clearInterval(timer);
    signal.removeEventListener('abort', cancel);
  }
}
