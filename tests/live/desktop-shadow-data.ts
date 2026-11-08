import { expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { PersonalBackup } from '../../src/services/personal-backup';
import type { WorkflowRun } from '../../src/domain/runtime/types';

export const recordedTitle = '历史真实设计恢复样本';
export async function importRecordedDesign(page: Page, output: string) {
  const run = JSON.parse(
    readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
  ) as WorkflowRun;
  const backup: PersonalBackup = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    storage: {
      'verification-workbench.conversations.v1': null,
      'verification-workbench.document.v1': null,
      'verification-workbench.frameworks.v1': null,
    },
    transcripts: [],
  };
  backup.storage['verification-workbench.conversations.v1'] = JSON.stringify([
    { id: run.sessionId, title: recordedTitle, profileId: run.defaultProfileId, messages: [], runs: [run] },
  ]);
  backup.transcripts = JSON.parse(
    readFileSync('docs/examples/generated/cli-transcript-2026-10-28/cli-turns.json', 'utf8'),
  );
  const input = path.join(output, 'recorded-input-backup.json');
  writeFileSync(input, JSON.stringify(backup));
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '数据管理', exact: true }).click();
  await page.locator('.settings-system-panel input[type=file]').setInputFiles(input);
  await page.getByRole('alertdialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.locator('.session-history-row')).toHaveCount(1);
  return backup.transcripts;
}

export async function deleteRecordedDesign(page: Page) {
  const row = page.locator('.session-history-row').filter({ hasText: recordedTitle });
  await row.getByRole('button', { name: '会话操作' }).click();
  await page.getByRole('button', { name: '删除会话', exact: true }).filter({ visible: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(row).toHaveCount(0);
  await expect.poll(() => storedTurnCount(page)).toBe(0);
}

export async function storedTurnCount(page: Page) {
  return (await storedTurns(page)).length;
}

export async function storedTurns(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('verification-workbench-transcripts', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('idb_unavailable'));
    });
    try {
      return await new Promise<{ id: string }[]>((resolve, reject) => {
        const request = db.transaction('turns').objectStore('turns').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('idb_unavailable'));
      });
    } finally {
      db.close();
    }
  });
}
