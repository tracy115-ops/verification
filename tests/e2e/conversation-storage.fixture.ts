import type { Page } from '@playwright/test';
import { createSession } from '../../src/domain/runtime/chat';

export async function storageFixture(page: Page, enabled = false) {
  const legacy = { ...createSession('codex-native'), title: '浏览器迁移前会话' };
  const native = { ...legacy, title: '数据库会话' };
  await page.addInitScript(
    ({ legacy, native, enabled }) => {
      const key = 'verification-workbench.conversations.v1';
      if (!localStorage.getItem('fixture.seeded')) {
        localStorage.setItem('fixture.seeded', 'true');
        localStorage.setItem(key, JSON.stringify([legacy]));
        localStorage.setItem(
          'fixture.native',
          JSON.stringify({
            schemaVersion: 1,
            revision: enabled ? 1 : 0,
            payload: enabled ? JSON.stringify([native]) : null,
          }),
        );
        if (enabled) localStorage.setItem('verification-workbench.conversation-store.v1', 'sqlite-v1');
      }
      Object.assign(globalThis, {
        isTauri: true,
        __TAURI_INTERNALS__: {
          transformCallback: () => 1,
          unregisterCallback: () => {},
          invoke: async (command: string, args?: { payload?: string; expectedRevision?: number }) => {
            if (command === 'read_conversation_store') {
              if (localStorage.getItem('fixture.read.error'))
                throw new Error(localStorage.getItem('fixture.read.error')!);
              return JSON.parse(localStorage.getItem('fixture.native')!);
            }
            if (command === 'write_conversation_store') {
              const value = JSON.parse(localStorage.getItem('fixture.native')!);
              if (value.revision !== args?.expectedRevision) throw new Error('store_conflict');
              if (localStorage.getItem('fixture.write.error')) throw new Error('store_unavailable');
              if (localStorage.getItem('fixture.write.pause'))
                await new Promise<void>((resolve) => {
                  const timer = setInterval(() => {
                    if (!localStorage.getItem('fixture.write.pause')) {
                      clearInterval(timer);
                      resolve();
                    }
                  }, 25);
                });
              value.revision++;
              value.payload = args!.payload;
              localStorage.setItem('fixture.native', JSON.stringify(value));
              return value.revision;
            }
            if (command === 'personal_shadow_status') return { schemaVersion: 1, snapshots: [] };
            if (command === 'save_personal_shadow') {
              if (localStorage.getItem('fixture.shadow.error')) throw new Error('shadow_unavailable');
              const bytes = new TextEncoder().encode(args!.payload!);
              const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
                b.toString(16).padStart(2, '0'),
              ).join('');
              localStorage.setItem('fixture.protected', args!.payload!);
              return {
                schemaVersion: 1,
                snapshots: [
                  {
                    id: 1,
                    createdAt: JSON.parse(args!.payload!).createdAt,
                    sha256,
                    bytes: bytes.length,
                    sessions: 1,
                    transcripts: 0,
                  },
                ],
              };
            }
            if (command === 'send_cli_turn') {
              localStorage.setItem('fixture.cli', 'called');
              throw new Error('unexpected_call');
            }
            throw new Error('offline_fixture');
          },
        },
      });
    },
    { legacy, native, enabled },
  );
}
export async function openStorageSettings(page: Page) {
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '数据管理', exact: true }).click();
}
export async function renameFirst(page: Page, title: string) {
  await page.locator('.session-history-row').first().getByRole('button', { name: '会话操作' }).click();
  await page.getByRole('button', { name: '重命名会话', exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('会话名称', { exact: true }).fill(title);
  await dialog.getByRole('button', { name: '保存名称' }).click();
}
