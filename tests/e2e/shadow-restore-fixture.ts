import type { Page } from '@playwright/test';
import { createSession } from '../../src/domain/runtime/chat';

export async function installRestoreFixture(page: Page) {
  const first = { ...createSession('codeagent-native'), title: '第一轮设计' };
  const second = { ...createSession('codeagent-native'), title: '新增设计' };
  const original = JSON.stringify([first, second]);
  const target = JSON.stringify([first]);
  const payload = (sessions: string, date: string) =>
    JSON.stringify({
      formatVersion: 1,
      createdAt: date,
      transcripts: [],
      storage: {
        'verification-workbench.conversations.v1': sessions,
        'verification-workbench.document.v1': null,
        'verification-workbench.frameworks.v1': null,
      },
    });
  const copies = [
    { id: 2, payload: payload(original, '2026-11-08T02:00:00Z') },
    { id: 1, payload: payload(target, '2026-11-08T01:00:00Z') },
  ];
  await page.addInitScript(
    ({ original, copies }) => {
      if (!sessionStorage.getItem('restore.copies')) {
        sessionStorage.setItem('restore.copies', JSON.stringify(copies));
        localStorage.setItem('verification-workbench.conversations.v1', original);
      }
      async function status() {
        const rows: { id: number; payload: string }[] = JSON.parse(sessionStorage.getItem('restore.copies')!);
        return {
          schemaVersion: 1,
          snapshots: await Promise.all(
            rows.map(async (row) => {
              const bytes = new TextEncoder().encode(row.payload);
              const value = JSON.parse(row.payload);
              const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
                b.toString(16).padStart(2, '0'),
              ).join('');
              return {
                id: row.id,
                sha256,
                bytes: bytes.length,
                createdAt: value.createdAt,
                sessions: JSON.parse(value.storage['verification-workbench.conversations.v1'] || '[]').length,
                transcripts: 0,
              };
            }),
          ),
        };
      }
      Object.assign(globalThis, {
        isTauri: true,
        __TAURI_INTERNALS__: {
          transformCallback: () => 1,
          unregisterCallback: () => {},
          invoke: async (command: string, args?: { snapshotId?: number; payload?: string }) => {
            if (command === 'personal_shadow_status') return status();
            const rows: { id: number; payload: string }[] = JSON.parse(
              sessionStorage.getItem('restore.copies')!,
            );
            if (command === 'export_personal_shadow') {
              const row = rows.find((row) => row.id === args?.snapshotId);
              if (!row) throw 'shadow_missing';
              return row.payload;
            }
            if (command === 'save_personal_shadow') {
              if (sessionStorage.getItem('restore.failSave')) throw 'shadow_unavailable';
              sessionStorage.setItem(
                'restore.saves',
                String(Number(sessionStorage.getItem('restore.saves') || 0) + 1),
              );
              rows.unshift({ id: rows[0].id + 1, payload: args!.payload! });
              sessionStorage.setItem('restore.copies', JSON.stringify(rows.slice(0, 2)));
              return status();
            }
            throw 'offline_fixture';
          },
        },
      });
    },
    { original, copies },
  );
  return { original, target };
}
