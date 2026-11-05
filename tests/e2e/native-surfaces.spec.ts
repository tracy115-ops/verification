import { expect, test } from '@playwright/test';

// Rendering contracts only: IPC responses are offline fixtures, not native execution.
for (const dark of [false, true])
  for (const width of [900, 1500])
    test(`checks desktop-only forms: dark=${dark}, width=${width}`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: width === 900 ? 650 : 960 });
      await page.addInitScript(
        ({ dark }) => {
          localStorage.setItem(
            'verification-workbench.appearance.v1',
            JSON.stringify({ locale: 'en-US', dark }),
          );
          let hosting = false;
          Object.assign(globalThis, {
            isTauri: true,
            __TAURI_INTERNALS__: {
              transformCallback: () => 1,
              unregisterCallback: () => {},
              invoke: async (command: string) => {
                const host = {
                  version: 1,
                  port: 4317,
                  addresses: ['http://127.0.0.1:4317'],
                  ownerToken: 'offline-only-owner-token',
                  discoverable: true,
                };
                if (command === 'collaboration_status') return hosting ? host : null;
                if (command === 'start_collaboration') {
                  hosting = true;
                  return host;
                }
                if (command === 'stop_collaboration') {
                  hosting = false;
                  return;
                }
                if (command === 'probe_agents')
                  return [
                    {
                      driver: 'codex',
                      status: 'found',
                      version: 'offline-fixture',
                      executable: 'C:\\Example Tools\\codex.cmd',
                      reason: null,
                    },
                  ];
                if (command === 'update_status')
                  return {
                    currentVersion: '0.8.3',
                    supported: true,
                    release: null,
                    ready: false,
                    proxyMode: 'system',
                  };
                if (command === 'update_network_settings')
                  return { config: { mode: 'system', address: '' }, source: 'environment' };
                if (command === 'read_logs')
                  return [
                    {
                      name: 'workbench.log',
                      bytes: 80,
                      text: '{"event":"cli.diagnostic","details":{"reason":"cli_auth_failed"}}',
                    },
                  ];
                throw new Error('offline_fixture_command');
              },
            },
          });
        },
        { dark },
      );
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('/');
      const capture = async (name: string) => {
        const result = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        expect(result.scroll).toBeLessThanOrEqual(result.width + 2);
        await page.screenshot({
          path: `.runtime/product-audit/native-${dark ? 'dark' : 'light'}-${width}-${name}.png`,
        });
      };
      await page.getByRole('button', { name: 'Project collaboration', exact: true }).click();
      await expect(page.locator('.lan-discovery')).toBeVisible();
      await capture('discovery');
      await page.locator('.app-settings button').click();
      await page.locator('.settings-navigation > button').nth(1).click();
      await page.getByRole('button', { name: 'Detect installed CLIs', exact: true }).click();
      await expect(page.locator('.settings-cli').filter({ hasText: 'codex' })).toContainText(
        'offline-fixture',
      );
      await capture('agents');
      await page.locator('.settings-navigation > button').nth(3).click();
      await expect(
        page.getByRole('button', { name: 'Start and allow LAN access', exact: true }),
      ).toBeEnabled();
      await capture('hosting-form');
      await page.getByRole('button', { name: 'Start and allow LAN access', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Stop service', exact: true })).toBeVisible();
      await capture('hosting-active');
      await page.getByRole('button', { name: 'Stop service', exact: true }).click();
      await page.locator('.settings-navigation > button').nth(4).click();
      await expect(page.getByRole('button', { name: 'Check for updates', exact: true })).toBeEnabled();
      await page.locator('.settings-content details > summary').first().click();
      await capture('proxy');
      await page.locator('.settings-navigation > button').nth(6).click();
      await expect(page.locator('.settings-log-text')).toContainText('cli_auth_failed');
      await capture('logs');
      expect(errors).toEqual([]);
    });
