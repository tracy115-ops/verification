import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const framework = {
  id: 'draft-framework',
  name: 'Draft fixture',
  adapter: 'python-unittest-v1',
  pythonCommand: 'python',
  frameworkSource: readFileSync('tests/fixtures/blackbox/framework.py', 'utf8'),
  instructions: 'Offline UI fixture',
  targetUrl: 'http://127.0.0.1:19401',
  timeoutSeconds: 30,
};
const saved = {
  formatVersion: 1,
  revision: 1,
  definition: JSON.parse(readFileSync('docs/examples/general-testing.workflow.json', 'utf8')),
  profiles: ['codex', 'claude'].map((driver) => ({
    id: `${driver}-native`,
    name: driver,
    driver,
    protocol: 'native',
    model: 'fixture',
    baseUrl: '',
    credentialRef: '',
  })),
  bindings: {},
  layout: {},
  nodeTitles: {},
};

test('keeps per-session drafts and selections across switching, page navigation and reload', async ({
  page,
}) => {
  await page.addInitScript(
    ({ saved, framework }) => {
      if (!localStorage.getItem('verification-workbench.document.v1')) {
        localStorage.setItem('verification-workbench.document.v1', JSON.stringify(saved));
        localStorage.setItem('verification-workbench.frameworks.v1', JSON.stringify([framework]));
      }
    },
    { saved, framework },
  );
  await page.goto('/');
  const input = page.locator('.session-composer textarea');
  await input.pressSequentially('draft A', { delay: 15 });
  await expect(input).toHaveValue('draft A');
  await page.getByRole('combobox', { name: '会话 Agent', exact: true }).selectOption('claude-native');
  await page.getByRole('combobox', { name: '已保存流程', exact: true }).selectOption('workflow');
  const scope = page.getByRole('combobox', { name: '本次调用范围', exact: true });
  await scope.selectOption(framework.id);
  const binding = page.locator('.session-binding-choice input[type=checkbox]');
  await binding.check();
  await page.locator('.session-history-new').click();
  await input.fill('draft B');
  await page.getByRole('combobox', { name: '对话上下文', exact: true }).selectOption('current');
  await page.locator('.session-history-item').nth(1).click();
  await expect(input).toHaveValue('draft A');
  await expect(scope).toHaveValue(framework.id);
  await expect(binding).toBeChecked();
  await expect(page.getByRole('combobox', { name: '会话 Agent', exact: true })).toHaveValue('claude-native');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: 'CLI 会话', exact: true }).click();
  await expect(input).toHaveValue('draft A');
  await page.reload();
  await expect(input).toHaveValue('draft A');
  await expect(scope).toHaveValue(framework.id);
  await expect(binding).toBeChecked();
  await page.locator('.session-history-item').first().click();
  await expect(input).toHaveValue('draft B');
  await expect(page.getByRole('combobox', { name: '对话上下文', exact: true })).toHaveValue('current');
});

test('finishes an attachment read in its original draft without overwriting newer text', async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    File.prototype.text = function () {
      return new Promise((resolve) => {
        Object.assign(globalThis, { finishDraftFile: () => original.call(this).then(resolve) });
      });
    };
  });
  await page.goto('/');
  const input = page.locator('.session-composer textarea');
  await input.fill('原始输入');
  await page
    .locator('.session-composer input[type=file]')
    .setInputFiles({ name: 'spec.md', mimeType: 'text/markdown', buffer: Buffer.from('附件正文') });
  await page.waitForFunction(
    () => typeof (globalThis as unknown as { finishDraftFile?: unknown }).finishDraftFile === 'function',
  );
  await input.fill('读取期间追加的输入');
  await page.locator('.session-history-new').click();
  await input.fill('其他会话');
  await page.evaluate(() => (globalThis as unknown as { finishDraftFile: () => void }).finishDraftFile());
  await expect(input).toHaveValue('其他会话');
  await page.locator('.session-history-item').nth(1).click();
  await expect(input).toHaveValue('读取期间追加的输入\n\n附件正文');
  await page.reload();
  await expect(input).toHaveValue('读取期间追加的输入\n\n附件正文');
});
