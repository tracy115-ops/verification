import { expect, test } from '@playwright/test';

test('limits old context, preserves messages and allows sending only the current message', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const session = {
      id: crypto.randomUUID(),
      title: '上下文验证',
      profileId: 'codeagent-native',
      runs: [],
      messages: [
        {
          id: crypto.randomUUID(),
          role: 'user',
          text: '大型旧需求'.repeat(4000),
          createdAt: new Date().toISOString(),
          status: 'complete',
        },
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: '旧需求回复',
          createdAt: new Date().toISOString(),
          status: 'complete',
        },
      ],
    };
    localStorage.setItem('verification-workbench.conversations.v1', JSON.stringify([session]));
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: (command: string, args: { request: { prompt: string } }) => {
          if (command !== 'send_cli_turn') return Promise.reject('fixture');
          Object.assign(globalThis, { contextRequestFixture: JSON.parse(args.request.prompt) });
          return Promise.resolve({
            status: 'completed',
            text: '上下文验证回复',
            errorCode: null,
            nativeSessionId: null,
          });
        },
      },
    });
  });
  await page.goto('/');
  const input = page.locator('.session-composer textarea');
  await input.fill('你好');
  const context = page.getByRole('combobox', { name: '对话上下文', exact: true });
  await expect(page.locator('.session-binding-choice')).toContainText('2 条旧消息');
  await context.selectOption('full');
  await expect(page.locator('.session-binding-choice')).not.toContainText('不携带');
  await context.selectOption('current');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(page.locator('.session-messages')).toContainText('上下文验证回复');
  const request = await page.evaluate(
    () =>
      (globalThis as unknown as { contextRequestFixture: { conversation: { role: string; text: string }[] } })
        .contextRequestFixture,
  );
  expect(request.conversation).toEqual([{ role: 'user', text: '你好' }]);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!),
  );
  expect(stored[0].messages[0].text.length).toBeGreaterThan(16000);
  await page.screenshot({ path: '.runtime/chat-context.png' });
  await page.setViewportSize({ width: 900, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
