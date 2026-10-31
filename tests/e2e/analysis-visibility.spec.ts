import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

for (const large of [false, true]) {
  test(`shows the actual analysis mode before any CLI reply; large=${large}`, async ({ page }) => {
    const definition = JSON.parse(readFileSync('docs/examples/general-testing.workflow.json', 'utf8'));
    const saved = {
      formatVersion: 1,
      revision: 1,
      definition,
      profiles: [
        {
          id: 'codeagent-native',
          name: 'CodeAgent fixture',
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
            invoke: (command: string, args: { request: { prompt: string } }) => {
              if (command === 'cancel_cli_turn') return Promise.resolve();
              if (command !== 'send_cli_turn') return Promise.reject('offline_fixture');
              return new Promise((resolve) =>
                Object.assign(globalThis, {
                  analysisVisibility: {
                    prompt: args.request.prompt,
                    finish: () =>
                      resolve({
                        status: 'timed_out',
                        text: '',
                        errorCode: 'cli_timeout_after_init',
                        nativeSessionId: null,
                      }),
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
    await page.getByRole('combobox', { name: '已保存流程', exact: true }).selectOption('workflow');
    const spec = large
      ? '接口要求：容量只能是2到8之间的整数。\n'.repeat(600)
      : '接口要求：容量只能是2到8之间的整数。';
    await page.locator('.session-composer textarea').fill(spec);
    await page.getByRole('button', { name: '调用流程', exact: true }).click();
    const card = page.locator('.session-cli-turn');
    await expect(card.getByRole('status').filter({ hasText: 'Agent 正在回复' })).toBeVisible();
    const title = card.locator('.session-cli-title h3');
    if (large) {
      await expect(title).toContainText('分析批次 1 /');
      await expect(page.locator('.session-step-list').first()).toContainText('已保存批次: 0 /');
    } else await expect(title).not.toContainText('分析批次');
    const request = await page.evaluate(() =>
      JSON.parse(
        (globalThis as unknown as { analysisVisibility: { prompt: string } }).analysisVisibility.prompt,
      ),
    );
    expect(Boolean(request.analysisBatch)).toBe(large);
    await page.screenshot({ path: `.runtime/analysis-waiting-${large ? 'batch' : 'single'}.png` });
    await page.evaluate(() =>
      (globalThis as unknown as { analysisVisibility: { finish: () => void } }).analysisVisibility.finish(),
    );
    await expect(card.getByRole('status').filter({ hasText: 'Agent 正在回复' })).toHaveCount(0);
  });
}
