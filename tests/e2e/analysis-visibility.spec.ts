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
            invoke: (
              command: string,
              args: { request: { prompt: string }; onEvent: { onmessage: (event: unknown) => void } },
            ) => {
              if (command === 'cancel_cli_turn') return Promise.resolve();
              if (command !== 'send_cli_turn') return Promise.reject('offline_fixture');
              return new Promise((resolve) =>
                Object.assign(globalThis, {
                  analysisVisibility: {
                    prompt: args.request.prompt,
                    emit: (event: unknown) => args.onEvent.onmessage(event),
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
    } else await expect(title).toContainText('单次分析');
    await expect(card.locator('.session-cli-request summary')).toContainText('字节');
    await expect(page.locator('.session-composer textarea')).toHaveValue('');
    const request = await page.evaluate(() =>
      JSON.parse(
        (globalThis as unknown as { analysisVisibility: { prompt: string } }).analysisVisibility.prompt,
      ),
    );
    expect(Boolean(request.analysisBatch)).toBe(large);
    await page.evaluate(() => {
      const fixture = (globalThis as unknown as { analysisVisibility: { emit: (event: unknown) => void } })
        .analysisVisibility;
      fixture.emit({
        type: 'progress',
        progress: {
          elapsedMs: 30000,
          inputWritten: true,
          lastOutputAgeMs: 25000,
          protocolRecords: 5,
          publicTextBytes: 0,
        },
      });
    });
    const progress = card.locator('.session-cli-progress');
    await expect(progress.locator('summary')).toContainText('已运行 30 秒');
    await expect(progress.locator('summary')).toContainText('已收到 CLI 状态，尚无回复正文');
    await progress.locator('summary').click();
    await expect(progress).toContainText('已有 25 秒没有新 CLI 输出');
    await page.evaluate(() =>
      (
        globalThis as unknown as { analysisVisibility: { emit: (event: unknown) => void } }
      ).analysisVisibility.emit({ type: 'progress', progress: { elapsedMs: 99999, reason: 'private data' } }),
    );
    await expect(progress).not.toContainText('private data');
    await page.screenshot({ path: `.runtime/analysis-waiting-${large ? 'batch' : 'single'}.png` });
    await page.evaluate(() =>
      (globalThis as unknown as { analysisVisibility: { finish: () => void } }).analysisVisibility.finish(),
    );
    await expect(card.getByRole('status').filter({ hasText: 'Agent 正在回复' })).toHaveCount(0);
    await expect(progress.locator('summary')).toContainText('CLI 最后状态');
    if (large) {
      await page.reload();
      await expect(page.locator('.session-cli-progress summary')).toContainText('已运行 30 秒');
      await expect(page.locator('.session-cli-progress summary')).toContainText('CLI 最后状态');
    }
    if (!large) {
      await page
        .getByRole('complementary', { name: '流程进度' })
        .getByRole('button', { name: '改用分批分析重试', exact: true })
        .click();
      await expect(page.locator('.session-cli-title h3').last()).toContainText('分析批次 1 / 1');
      await page.evaluate(() =>
        (globalThis as unknown as { analysisVisibility: { finish: () => void } }).analysisVisibility.finish(),
      );
      await expect(
        page.locator('.session-cli-turn').last().getByRole('status').filter({ hasText: 'Agent 正在回复' }),
      ).toHaveCount(0);
    }
  });
}
