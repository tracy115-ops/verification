import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

test('checks all five shared project steps across locales, themes and window widths', async ({
  browser,
  request,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const root = '.runtime/product-audit';
  mkdirSync(root, { recursive: true });
  const token = 'offline-team-e2e-owner-token-000000000000000000000000';
  const headers = { Authorization: `Bearer ${token}` };
  const title = `Team layout audit ${Date.now()}`;
  const created = await request.post('/api/team/projects', {
    headers,
    data: {
      title,
      mode: 'black_box',
      locale: 'en-US',
      topic: 'Room capacity must be an integer between 2 and 8 inclusive. Reject invalid input.',
      interfaces: [
        {
          id: 'IF1',
          name: 'Room creation',
          contract: 'POST /rooms accepts capacity from 2 to 8 inclusive; otherwise returns 400.',
        },
      ],
    },
  });
  expect(created.ok()).toBe(true);
  const project = await created.json();
  // Actual HTTP/SQLite design suggestions, deliberately without any model invocation.
  const suggested = await request.post(`/api/team/projects/${project.id}/commands`, {
    headers,
    data: { revision: project.revision, command: { type: 'suggest' } },
  });
  expect(suggested.ok()).toBe(true);
  const results: { id: string; width: number; scrollWidth: number; clipped: string[] }[] = [];
  for (const locale of ['zh-CN', 'en-US'])
    for (const dark of [false, true])
      for (const width of [900, 1500]) {
        const context = await browser.newContext({ viewport: { width, height: 800 } });
        try {
          const page = await context.newPage();
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          await page.addInitScript(
            ({ locale, dark, token }) => {
              localStorage.setItem('verification-workbench.appearance.v1', JSON.stringify({ locale, dark }));
              sessionStorage.setItem('verification-workbench.team-token.v1', token);
            },
            { locale, dark, token },
          );
          await page.goto(baseURL!);
          await page.locator('.app-sidebar > nav button').nth(4).click();
          await page.getByRole('button', { name: title, exact: true }).click();
          await expect(page.locator('.team-content-steps')).toBeVisible();
          for (let step = 0; step < 5; step++) {
            await page.locator('.team-content-steps > button').nth(step).click();
            const bounds = await page.evaluate(() => ({
              width: innerWidth,
              scrollWidth: document.documentElement.scrollWidth,
              clipped: [...document.querySelectorAll<HTMLElement>('button,input,textarea,select')]
                .filter((element) => {
                  const rect = element.getBoundingClientRect();
                  return rect.width && rect.height && (rect.left < -2 || rect.right > innerWidth + 2);
                })
                .map(
                  (element) =>
                    element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName,
                ),
            }));
            const id = `team-project-${locale}-${dark ? 'dark' : 'light'}-${width}-step${step}`;
            await page.screenshot({ path: `${root}/${id}.png`, fullPage: true });
            results.push({ id, ...bounds });
            expect(bounds.scrollWidth, id).toBeLessThanOrEqual(bounds.width + 2);
            expect(bounds.clipped, id).toEqual([]);
          }
          expect(errors).toEqual([]);
        } finally {
          await context.close();
        }
      }
  expect(results).toHaveLength(40);
  writeFileSync(
    `${root}/team-project-matrix.json`,
    JSON.stringify({ originalHttpService: true, freshModelCall: false, results }, null, 2),
  );
});
