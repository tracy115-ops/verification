import { invoke } from '@tauri-apps/api/core';
import { hasDesktopBridge } from './agent-api';
import { decodeConversations, CONVERSATIONS_KEY } from './conversation-repository';
import { DurableConversations } from './durable-conversations';

export const CONVERSATION_STORE_MODE = 'verification-workbench.conversation-store.v1';
export interface NativeConversationSnapshot {
  schemaVersion: 1;
  revision: number;
  payload: string | null;
}
let active: DurableConversations | null = null;
let boot: Promise<void> | null = null;
const listeners = new Set<() => void>();
const idle = { revision: 0, phase: 'browser' as const, error: null };
export function subscribeConversationStorage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const conversationStorageState = () => active?.snapshot() ?? idle;
export function conversationStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  return active ?? localStorage;
}
export function requiresConversationBoot() {
  try {
    return localStorage.getItem(CONVERSATION_STORE_MODE) !== null;
  } catch {
    return true;
  }
}
export function validateConversationPayload(text: string) {
  if (text.length > 2_000_000) throw new Error('store_limit');
  decodeConversations(JSON.parse(text));
}
export function decodeNativeConversationSnapshot(value: unknown): NativeConversationSnapshot {
  const v = value as Partial<NativeConversationSnapshot> | null;
  if (
    !v ||
    v.schemaVersion !== 1 ||
    !Number.isSafeInteger(v.revision) ||
    v.revision! < 0 ||
    (v.revision === 0 ? v.payload !== null : typeof v.payload !== 'string')
  )
    throw new Error('store_invalid');
  if (typeof v.payload === 'string') validateConversationPayload(v.payload);
  return value as NativeConversationSnapshot;
}
export async function readNativeConversations() {
  return decodeNativeConversationSnapshot(await invoke('read_conversation_store'));
}
export async function writeNativeConversations(payload: string, revision: number) {
  validateConversationPayload(payload);
  const next: unknown = await invoke('write_conversation_store', { payload, expectedRevision: revision });
  if (!Number.isSafeInteger(next) || next !== revision + 1) throw new Error('store_invalid');
  return next as number;
}
export async function bootConversationStorage() {
  if (!requiresConversationBoot() || active) return;
  if (localStorage.getItem(CONVERSATION_STORE_MODE) !== 'sqlite-v1') throw new Error('store_version');
  if (!hasDesktopBridge()) throw new Error('store_unavailable');
  if (!boot)
    boot = (async () => {
      const snapshot = await readNativeConversations();
      if (snapshot.payload === null) throw new Error('store_missing');
      active = new DurableConversations(snapshot.payload, snapshot.revision, writeNativeConversations);
      active.subscribe(() => {
        for (const listener of listeners) listener();
      });
      for (const listener of listeners) listener();
    })().catch((error) => {
      boot = null;
      throw error;
    });
  await boot;
}
export const flushConversationStorage = async () => {
  await active?.flush();
};
export const retryConversationStorage = async () => {
  await active?.retry();
};
export const hasPendingConversationWrites = () => !!active && active.snapshot().phase !== 'saved';
export function assertConversationStorageHealthy() {
  if (active?.snapshot().error) throw new Error(active.snapshot().error!);
}
export function browserConversationSource() {
  return localStorage.getItem(CONVERSATIONS_KEY) ?? '[]';
}
