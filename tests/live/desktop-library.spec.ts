import { chromium, expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { zh, en } from '../../src/shared/i18n/messages';

test('manages workflows and navigates every page in the actual Release desktop', async () => {
  const endpoint = process.env.DESKTOP_AUDIT_ENDPOINT;
  test.skip(!endpoint, 'Explicit isolated native desktop audit required.');
  const browser = await chromium.connectOverCDP(endpoint!);
  const page = browser.contexts()[0].pages()[0];
  const output = path.resolve('.runtime/native-workflow-library');
  mkdirSync(output, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    expect(page.url()).toContain('tauri.localhost');
    await page.locator('.app-sidebar > nav').getByRole('button', { name: zh.workflow, exact: true }).click();
    await page.getByRole('button', { name: zh.save, exact: true }).click();
    await page.getByRole('button', { name: zh.workflowLibrary, exact: true }).click();
    const dialog = page.getByRole('alertdialog', { name: zh.workflowLibrary });
    await dialog.getByRole('button', { name: zh.workflowCreate, exact: true }).click();
    await dialog.getByLabel(zh.workflowCreateName).fill('原生桌面：订单状态与幂等验证');
    await dialog.getByRole('button', { name: zh.workflowCreateConfirm }).click();
    await page.getByRole('button', { name: zh.workflowLibrary, exact: true }).click();
    await expect(dialog.locator('.workflow-library-list li')).toHaveCount(2);
    await page.screenshot({ path: path.join(output, 'library-light-zh.png') });
    await dialog.getByRole('button', { name: zh.workflowClose }).click();
    await page.locator('.app-sidebar > nav').getByRole('button', { name: zh.sessions, exact: true }).click();
    await page.getByLabel(zh.savedWorkflow).selectOption('general-testing');
    await page.reload();
    await expect(page.getByLabel(zh.savedWorkflow).locator('option:checked')).toContainText(zh.preset);
    for (const label of [zh.workflow, zh.assetsTitle, zh.runs, zh.team]) {
      await page.locator('.app-sidebar > nav').getByRole('button', { name: label, exact: true }).click();
      await expect(page.locator('.app-content')).toBeVisible();
    }
    await page.locator('.app-settings button').click();
    for (const label of [
      zh.agents,
      zh.frameworkSettings,
      zh.lan_settings,
      zh.systemUpdates,
      zh.dataManagement,
      zh.diagnosticsLogs,
      zh.generalSettings,
    ]) {
      await page.locator('.settings-navigation').getByRole('button', { name: label, exact: true }).click();
      await expect(page.locator('.settings-content')).toBeVisible();
      if (label === zh.systemUpdates && process.env.DESKTOP_AUDIT_VERSION)
        await expect(page.locator('.settings-version-row strong')).toHaveText(
          process.env.DESKTOP_AUDIT_VERSION,
        );
    }
    await page.getByLabel(zh.language).selectOption('en-US');
    await page.getByRole('button', { name: en.dark, exact: true }).click();
    await page.locator('.app-sidebar > nav').getByRole('button', { name: en.workflow, exact: true }).click();
    await page.getByRole('button', { name: en.workflowLibrary, exact: true }).click();
    await expect(page.getByRole('alertdialog', { name: en.workflowLibrary })).toBeVisible();
    await page.screenshot({ path: path.join(output, 'library-dark-en.png') });
    expect(errors).toEqual([]);
    writeFileSync(
      path.join(output, 'summary.json'),
      JSON.stringify(
        {
          originalIpc: true,
          pages: 6,
          settingsSections: 7,
          workflowCount: 2,
          choiceSurvivedReload: true,
          freshModelCall: false,
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
