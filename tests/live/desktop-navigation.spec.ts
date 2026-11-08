import { chromium, expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { importRecordedDesign } from './desktop-shadow-data';
import { zh } from '../../src/shared/i18n/messages';

test('checks page continuity and native settings in an isolated actual Release WebView', async () => {
  const endpoint = process.env.DESKTOP_AUDIT_ENDPOINT;
  test.skip(!endpoint, 'Explicit isolated native desktop audit required.');
  const browser = await chromium.connectOverCDP(endpoint!);
  const page = browser.contexts()[0].pages()[0];
  const output = path.resolve('.runtime/native-navigation');
  mkdirSync(output, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    expect(page.url()).toContain('tauri.localhost');
    await importRecordedDesign(page, output);
    const nav = page.locator('.app-sidebar > nav');
    const go = async (name: string) => nav.getByRole('button', { name, exact: true }).click();
    await go(zh.sessions);
    await expect(page.locator('.session-welcome')).toHaveCount(0);
    await expect(page.locator('.session-cli-turn').first()).toBeVisible();
    await page.screenshot({ path: path.join(output, 'sessions.png') });
    await go(zh.assetsTitle);
    await page.locator('.assets-tabs > button').nth(1).click();
    const query = page.locator('.assets-workspace input');
    await query.fill('F1');
    await go(zh.sessions);
    await go(zh.assetsTitle);
    await expect(query).toHaveValue('F1');
    await expect(page.locator('.assets-tabs > button').nth(1)).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: path.join(output, 'assets.png') });
    await go(zh.runs);
    await page.getByRole('searchbox', { name: zh.runSearch }).fill('unmatched native query');
    await go(zh.workflow);
    await expect(page.locator('.react-flow')).toBeVisible();
    await go(zh.runs);
    await expect(page.getByRole('searchbox', { name: zh.runSearch })).toHaveValue('unmatched native query');
    await page.locator('.app-settings button').click();
    const tabs = page.locator('.settings-navigation');
    await tabs.getByRole('button', { name: zh.frameworkSettings, exact: true }).click();
    const name = page.getByRole('textbox', { name: zh.frameworkName, exact: true });
    await name.fill('Unsaved native draft');
    await go(zh.sessions);
    await page.locator('.app-settings button').click();
    await expect(name).toHaveValue('Unsaved native draft');
    let observedVersion = '';
    for (const label of [
      zh.agents,
      zh.lan_settings,
      zh.systemUpdates,
      zh.dataManagement,
      zh.diagnosticsLogs,
      zh.generalSettings,
    ]) {
      await tabs.getByRole('button', { name: label, exact: true }).click();
      await expect(page.locator('.settings-content')).toBeVisible();
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      if (label === zh.systemUpdates) {
        observedVersion = (await page.locator('.settings-version-row strong').textContent())!;
        if (process.env.DESKTOP_AUDIT_VERSION)
          expect(observedVersion).toBe(process.env.DESKTOP_AUDIT_VERSION);
      }
    }
    await go(zh.team);
    await expect(page.locator('.team-workspace, .lan-discovery')).toBeVisible();
    expect(errors).toEqual([]);
    writeFileSync(
      path.join(output, 'summary.json'),
      JSON.stringify(
        {
          version: observedVersion,
          originalIpc: true,
          importedHistoricalDesign: true,
          freshModelCall: false,
          pages: ['sessions', 'workflow', 'assets', 'runs', 'settings', 'team'],
          assetQueryRetained: true,
          runQueryRetained: true,
          frameworkDraftRetained: true,
          settingsSectionsVisited: 7,
          unhandledErrors: errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
});
