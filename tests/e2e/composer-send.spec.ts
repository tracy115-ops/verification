import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('supports Enter and IME without retaining accepted text until the CLI finishes', async ({ page }) => {
  const saved = {
    formatVersion: 1,
    revision: 1,
    definition: JSON.parse(readFileSync('docs/examples/general-testing.workflow.json', 'utf8')),
    profiles: [
      {
        id: 'codeagent-native',
        name: 'CodeAgent',
        driver: 'codeagent',
        protocol: 'native',
        model: '',
        baseUrl: '',
        credentialRef: '',
      },
    ],
    bindings: {},
    layout: {},
    nodeTitles: {},
  };
  await page.addInitScript(
    ({ saved }) => {
      localStorage.setItem('verification-workbench.document.v1', JSON.stringify(saved));
      Object.assign(globalThis, {
        isTauri: true,
        __TAURI_INTERNALS__: {
          transformCallback: () => 1,
          unregisterCallback: () => {},
          invoke: (command: string) => {
            if (command !== 'send_cli_turn') return Promise.reject('offline_fixture');
            return new Promise((resolve) =>
              Object.assign(globalThis, {
                composerFixture: {
                  finish: () =>
                    resolve({ status: 'completed', text: '收到', errorCode: null, nativeSessionId: null }),
                },
              }),
            );
          },
        },
      });
    },
    { saved },
  );
  await page.goto('/');
  const input = page.locator('.session-composer textarea');
  await input.fill('你好');
  await input.press('Shift+Enter');
  await expect(input).toHaveValue('你好\n');
  await expect(page.locator('.session-pending-reply')).toHaveCount(0);
  await input.dispatchEvent('compositionstart');
  await input.press('Enter');
  await expect(page.locator('.session-pending-reply')).toHaveCount(0);
  await input.dispatchEvent('compositionend');
  await input.fill('你好');
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect(page.locator('.session-pending-reply')).toBeVisible();
  await page.evaluate(() =>
    (globalThis as unknown as { composerFixture: { finish: () => void } }).composerFixture.finish(),
  );
  await expect(page.locator('.session-pending-reply')).toHaveCount(0);
  await input.fill('按钮发送');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(input).toHaveValue('');
  await expect(page.locator('.session-pending-reply')).toBeVisible();
  await page.evaluate(() =>
    (globalThis as unknown as { composerFixture: { finish: () => void } }).composerFixture.finish(),
  );
  await expect(page.locator('.session-pending-reply')).toHaveCount(0);
});
