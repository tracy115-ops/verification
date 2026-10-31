import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { WorkbenchDocument } from '../../src/domain/workflow';
import type { WorkflowRun } from '../../src/domain/runtime/types';
import { createSession } from '../../src/domain/runtime/chat';

test('shows pending and streamed Agent replies beside an existing task', async ({ page }) => {
  // Offline IPC fixture: validates the real UI, not model inference or CLI installation.
  const saved: WorkbenchDocument = {
    formatVersion: 1,
    revision: 1,
    definition: JSON.parse(readFileSync('docs/examples/general-testing.workflow.json', 'utf8')),
    profiles: [
      {
        id: 'codex-native',
        name: 'Offline fixture',
        driver: 'codex',
        protocol: 'native',
        model: 'fixture-model',
        baseUrl: '',
        credentialRef: '',
      },
    ],
    bindings: {},
    layout: {},
    nodeTitles: {},
  };
  const session = createSession('codex-native');
  const run: WorkflowRun = {
    id: crypto.randomUUID(),
    sessionId: session.id,
    createdAt: new Date().toISOString(),
    scope: 'design',
    snapshot: saved,
    plan: saved.definition.nodes.slice(0, 7),
    profiles: saved.profiles,
    defaultProfileId: 'codex-native',
    spec: '接口测试',
    status: 'cancelled',
    steps: Object.fromEntries(
      saved.definition.nodes.map((node) => [node.id, { status: 'pending', attempts: 0 }]),
    ),
    artifacts: {},
    approvals: [],
  };
  session.runs = [run];
  session.title = '回复状态交互验证';
  await page.addInitScript(
    ({ saved, session }) => {
      localStorage.setItem('verification-workbench.document.v1', JSON.stringify(saved));
      localStorage.setItem('verification-workbench.conversations.v1', JSON.stringify([session]));
      Object.assign(globalThis, {
        isTauri: true,
        __TAURI_INTERNALS__: {
          transformCallback: () => 1,
          unregisterCallback: () => {},
          invoke: (command: string, args: { onEvent: { onmessage: (event: unknown) => void } }) => {
            if (command !== 'send_cli_turn') return Promise.reject(new Error('offline_fixture'));
            return new Promise((resolve) =>
              Object.assign(globalThis, {
                replyFixture: {
                  emit: (text: string) => args.onEvent.onmessage({ type: 'text', text }),
                  progress: () =>
                    args.onEvent.onmessage({
                      type: 'progress',
                      progress: {
                        elapsedMs: 15000,
                        inputWritten: true,
                        lastOutputAgeMs: 10000,
                        protocolRecords: 5,
                        publicTextBytes: 0,
                      },
                    }),
                  finish: () =>
                    resolve({
                      status: 'completed',
                      text: '你好，已收到你的消息。',
                      errorCode: null,
                      nativeSessionId: null,
                    }),
                },
              }),
            );
          },
        },
      });
    },
    { saved, session },
  );
  await page.goto('/');
  await page.locator('.session-composer textarea').fill('你好呀');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  const pending = page.locator('.session-pending-reply');
  await expect(pending.getByRole('status')).toHaveText('Agent 正在回复');
  await expect(pending).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() =>
    (globalThis as unknown as { replyFixture: { progress: () => void } }).replyFixture.progress(),
  );
  await expect(pending.locator('.session-cli-progress summary')).toContainText(
    '已收到 CLI 状态，尚无回复正文',
  );
  expect(
    await pending
      .locator('.session-reply-dots > span')
      .first()
      .evaluate((dot) => getComputedStyle(dot).animationName),
  ).toBe('session-reply-pulse');
  await page.screenshot({ path: '.runtime/agent-reply-waiting.png' });
  await page.evaluate(() =>
    (globalThis as unknown as { replyFixture: { emit: (text: string) => void } }).replyFixture.emit(
      '你好，已收到你的消息。',
    ),
  );
  await expect(pending).toContainText('你好，已收到你的消息。');
  await expect(pending.locator('.session-cli-progress summary')).toContainText('已收到回复正文');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await pending
      .locator('.session-reply-dots > span')
      .first()
      .evaluate((dot) => getComputedStyle(dot).animationName),
  ).toBe('none');
  await page.evaluate(() =>
    (globalThis as unknown as { replyFixture: { finish: () => void } }).replyFixture.finish(),
  );
  await expect(pending).toHaveCount(0);
  await expect(
    page.locator('.session-message-text').filter({ hasText: '你好，已收到你的消息。' }),
  ).toHaveCount(1);
});
