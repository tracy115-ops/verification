import { expect, test, type Page } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { zh, en } from '../../src/shared/i18n/messages';

const archived = JSON.parse(
  readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
);
const root = process.env.PRODUCT_AUDIT_ROOT ?? '.runtime/product-audit';
mkdirSync(root, { recursive: true });

async function inspect(page: Page, name: string) {
  await expect(page.locator('.app-main')).toBeVisible();
  const result = await page.evaluate(() => {
    const clipped: string[] = [],
      unnamed: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>('button, input, select, textarea')) {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || element.closest('.react-flow')) continue;
      const label =
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        element.textContent?.trim() ||
        '';
      if (element.tagName === 'BUTTON' && !label && !element.getAttribute('aria-labelledby'))
        unnamed.push(element.outerHTML.slice(0, 200));
      if (rect.left < -2 || rect.right > innerWidth + 2) clipped.push(label.slice(0, 80) || element.tagName);
    }
    return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, clipped, unnamed };
  });
  writeFileSync(`${root}/${name}.json`, JSON.stringify(result, null, 2));
  await page.screenshot({ path: `${root}/${name}.png` });
  const content = page.locator('.app-content');
  const scrolls = await content.evaluate((element) => element.scrollHeight > element.clientHeight + 50);
  if (scrolls) {
    await content.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await page.screenshot({ path: `${root}/${name}-bottom.png` });
    await content.evaluate((element) => {
      element.scrollTop = 0;
    });
  }
  expect
    .soft(result.scrollWidth, `${name}: document horizontal overflow`)
    .toBeLessThanOrEqual(result.width + 2);
  expect.soft(result.clipped, `${name}: clipped controls`).toEqual([]);
  expect.soft(result.unnamed, `${name}: unnamed buttons`).toEqual([]);
}

for (const locale of ['zh-CN', 'en-US'] as const)
  for (const dark of [false, true])
    for (const width of [900, 1500])
      test(`audits all product surfaces: ${locale}, dark=${dark}, width=${width}`, async ({ page }) => {
        test.setTimeout(90_000);
        const t = locale === 'zh-CN' ? zh : en;
        const tag = `${locale}-${dark ? 'dark' : 'light'}-${width}`;
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.setViewportSize({ width, height: width === 900 ? 650 : 960 });
        await page.addInitScript(
          ({ run, locale, dark }) => {
            localStorage.setItem('verification-workbench.appearance.v1', JSON.stringify({ locale, dark }));
            if (!localStorage.getItem('verification-workbench.conversations.v1')) {
              const sessions = [
                {
                  id: run.sessionId,
                  title: '跨系统支付与库存一致性 / Cross-system payment and inventory verification',
                  profileId: 'codex-native',
                  messages: [],
                  runs: [run],
                },
                ...Array.from({ length: 25 }, (_, index) => ({
                  id: `audit-session-${index}`,
                  title: `设计任务 ${index + 1} / Design task with a long title ${index + 1}`,
                  profileId: 'codex-native',
                  messages: [],
                  runs: [],
                })),
              ];
              localStorage.setItem('verification-workbench.conversations.v1', JSON.stringify(sessions));
              localStorage.setItem('verification-workbench.active-conversation', run.sessionId);
            }
          },
          { run: archived, locale, dark },
        );
        await page.goto('/');
        await expect(page.locator('.session-workspace')).toBeVisible();
        await inspect(page, `${tag}-sessions`);
        const nav = page.locator('.app-sidebar > nav');
        await nav.getByRole('button', { name: t.workflow, exact: true }).click();
        await expect(page.locator('.react-flow')).toBeVisible();
        const surface = await page
          .locator('.workflow-node')
          .first()
          .evaluate((node) => getComputedStyle(node).backgroundColor);
        await expect(page.locator('.react-flow__minimap')).toHaveCSS('background-color', surface);
        await expect(page.locator('.react-flow__controls-button').first()).toHaveCSS(
          'background-color',
          surface,
        );
        await inspect(page, `${tag}-workflow`);
        await nav.getByRole('button', { name: t.runs, exact: true }).click();
        await expect(page.locator('.run-records')).toBeVisible();
        await inspect(page, `${tag}-runs`);
        await nav.getByRole('button', { name: t.assetsTitle, exact: true }).click();
        await expect(page.locator('.assets-workspace')).toBeVisible();
        for (const [index, view] of ['requirements', 'factors', 'scenarios', 'cases'].entries()) {
          await page.locator('.assets-tabs > button').nth(index).click();
          await inspect(page, `${tag}-${view}`);
        }
        await nav.getByRole('button', { name: t.team, exact: true }).click();
        await expect(page.locator('.team-workspace')).toBeVisible();
        await inspect(page, `${tag}-team`);
        await page.locator('.app-settings button').click();
        await expect(page.locator('.settings-navigation')).toBeVisible();
        for (const [index, tab] of [
          'general',
          'agents',
          'frameworks',
          'collaboration',
          'updates',
          'data',
          'logs',
        ].entries()) {
          await page.locator('.settings-navigation > button').nth(index).click();
          await expect(page.locator('.settings-content')).not.toBeEmpty();
          if (tab === 'frameworks') {
            const fileBackground = await page
              .locator('.workbench-file')
              .evaluate((input) => getComputedStyle(input, '::file-selector-button').backgroundColor);
            expect(fileBackground).toBe(surface);
          }
          await inspect(page, `${tag}-${tab}`);
        }
        expect(errors, `${tag}: unhandled UI errors`).toEqual([]);
      });
