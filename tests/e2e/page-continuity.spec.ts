import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { zh } from '../../src/shared/i18n/messages';

test('keeps settings section and independent Agent/framework drafts across navigation', async ({ page }) => {
  await page.goto('/');
  const settings = page.locator('.app-settings button');
  const tabs = page.locator('.settings-navigation');
  await settings.click();
  await tabs.getByRole('button', { name: zh.frameworkSettings, exact: true }).click();
  const form = page.locator('.settings-framework-form:visible');
  const name = form.getByRole('textbox', { name: zh.frameworkName, exact: true });
  const picker = page.getByRole('combobox', { name: zh.frameworkProfile, exact: true });
  const originalProfile = await picker.inputValue();
  await name.fill('Unsaved original framework');
  await page.getByRole('button', { name: zh.newFramework, exact: true }).click();
  await name.fill('Unsaved second framework');
  const freshProfile = await picker.inputValue();
  await picker.selectOption(originalProfile);
  await expect(name).toHaveValue('Unsaved original framework');
  await picker.selectOption(freshProfile);
  await expect(name).toHaveValue('Unsaved second framework');
  await picker.selectOption(originalProfile);
  await tabs.getByRole('button', { name: zh.agents, exact: true }).click();
  const agent = page.getByRole('combobox', { name: zh.agentSetupChoose, exact: true });
  await agent.selectOption('claude-native');
  const model = page.locator('.settings-agent-setup:visible input[maxlength="200"]');
  await model.fill('draft-model');
  await agent.selectOption('codex-native');
  await agent.selectOption('claude-native');
  await expect(model).toHaveValue('draft-model');
  await page.locator('.app-sidebar > nav').getByRole('button', { name: zh.workflow, exact: true }).click();
  await settings.click();
  await expect(tabs.getByRole('button', { name: zh.agents, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(agent).toHaveValue('claude-native');
  await expect(model).toHaveValue('draft-model');
  await tabs.getByRole('button', { name: zh.frameworkSettings, exact: true }).click();
  await expect(name).toHaveValue('Unsaved original framework');
  await picker.selectOption(freshProfile);
  await page.getByRole('button', { name: zh.cancelAction, exact: true }).click();
  await expect(name).toHaveValue('Unsaved original framework');
  await expect(picker.locator(`option[value="${freshProfile}"]`)).toHaveCount(0);
  await page.reload();
  await settings.click();
  await tabs.getByRole('button', { name: zh.frameworkSettings, exact: true }).click();
  await expect(name).not.toHaveValue('Unsaved original framework');
});

test('returning from conversation preserves asset selection and run filters without leaking task data', async ({
  page,
}) => {
  const run = JSON.parse(readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'));
  await page.addInitScript((run) => {
    localStorage.setItem(
      'verification-workbench.conversations.v1',
      JSON.stringify([
        {
          id: run.sessionId,
          title: 'Continuity audit',
          profileId: 'codex-native',
          messages: [],
          runs: [run],
        },
        {
          id: 'empty-audit-session',
          title: 'Empty audit session',
          profileId: 'codex-native',
          messages: [],
          runs: [],
        },
      ]),
    );
    localStorage.setItem('verification-workbench.active-conversation', run.sessionId);
  }, run);
  await page.goto('/');
  await expect(page.locator('.session-welcome')).toHaveCount(0);
  const nav = page.locator('.app-sidebar > nav');
  const assets = nav.getByRole('button', { name: zh.assetsTitle, exact: true });
  await assets.click();
  await page.locator('.assets-tabs > button').nth(1).click();
  const search = page.locator('.assets-workspace input');
  await search.fill('F1');
  await page.locator('.assets-item').first().click();
  const detail = (await page.locator('.assets-detail').textContent())!;
  await page.getByRole('button', { name: zh.assetBackToSession, exact: true }).click();
  await assets.click();
  await expect(page.locator('.assets-tabs > button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(search).toHaveValue('F1');
  await expect(page.locator('.assets-detail')).toHaveText(detail);
  await nav.getByRole('button', { name: zh.runs, exact: true }).click();
  const runSearch = page.getByRole('searchbox', { name: zh.runSearch });
  await runSearch.fill('Continuity');
  await nav.getByRole('button', { name: zh.sessions, exact: true }).click();
  await nav.getByRole('button', { name: zh.runs, exact: true }).click();
  await expect(runSearch).toHaveValue('Continuity');
  await page.locator('.session-history-item').filter({ hasText: 'Empty audit session' }).click();
  await assets.click();
  await expect(page.locator('.assets-empty')).toBeVisible();
  await expect(page.locator('.assets-detail')).toHaveCount(0);
});
