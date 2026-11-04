import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const original = JSON.parse(
  readFileSync('docs/examples/generated/cli-transcript-2026-10-28/run.json', 'utf8'),
);
const design = Object.values(original.artifacts).find(
  (item: unknown) => (item as { type: string }).type === 'TestDesign',
) as { value: { scenarios: Record<string, unknown>[] } };
const patch = {
  summary: '新增独立核查场景',
  factors: [],
  scenarios: [
    {
      action: 'add',
      value: {
        ...design.value.scenarios[0],
        id: 'SC-new',
        title: '会话补充场景',
        factorLevels: design.value.scenarios[0].factorLevels ?? [],
      },
    },
  ],
  questions: [],
};

for (const unresolved of [false, true])
  test(`reviews a conversational design proposal without implicit changes; unresolved=${unresolved}`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ run, output }) => {
        if (!localStorage.getItem('verification-workbench.conversations.v1'))
          localStorage.setItem(
            'verification-workbench.conversations.v1',
            JSON.stringify([
              {
                id: run.sessionId,
                title: '对话设计修改',
                profileId: 'codeagent-native',
                messages: [],
                runs: [run],
              },
            ]),
          );
        Object.assign(globalThis, {
          isTauri: true,
          __TAURI_INTERNALS__: {
            transformCallback: () => 1,
            unregisterCallback: () => {},
            invoke: (command: string) =>
              command === 'send_cli_turn'
                ? Promise.resolve({
                    status: 'completed',
                    text: JSON.stringify(output),
                    errorCode: null,
                    nativeSessionId: null,
                  })
                : Promise.reject('offline_fixture'),
          },
        });
      },
      {
        run: original,
        output: unresolved
          ? { summary: '需要澄清', factors: [], scenarios: [], questions: ['需要确定超时预期'] }
          : patch,
      },
    );
    await page.goto('/');
    const right = page.getByRole('complementary', { name: '流程进度' });
    await right.getByRole('button', { name: '让 Agent 补充设计', exact: true }).click();
    await page.locator('.session-composer textarea').fill('补充一个独立场景');
    await page.getByRole('button', { name: '生成修改提议', exact: true }).click();
    await expect(page.locator('.session-composer textarea')).toHaveValue('');
    await right.getByRole('button', { name: '查看提议差异', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '查看提议差异', exact: true });
    const apply = dialog.getByRole('button', { name: '合入并重新评审', exact: true });
    const current = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('verification-workbench.conversations.v1')!)[0].runs[0],
      );
    expect((await current()).approvals).toEqual(original.approvals);
    if (unresolved) {
      await expect(dialog).toContainText('需要确定超时预期');
      await expect(apply).toBeDisabled();
      await dialog.getByRole('button', { name: '暂不采纳', exact: true }).click();
      const dismissed = await current();
      expect(dismissed.status).toBe(original.status);
      expect(dismissed.approvals).toEqual(original.approvals);
    } else {
      await expect(dialog).toContainText('会话补充场景');
      await apply.click();
      await expect(dialog).toContainText('已合入，后续需要重新评审');
      const revised = await current();
      expect(revised.status).toBe('awaiting_review');
      expect(revised.approvals).toHaveLength(1);
      expect(revised.artifacts['history.design.1'].value.source).toBe('agent_approved');
      expect(
        Object.values(revised.artifacts).some(
          (item: unknown) => (item as { type: string }).type === 'TestCaseSet',
        ),
      ).toBe(false);
      await page.reload();
      await expect(right).toContainText('已合入，后续需要重新评审');
      await page
        .locator('.session-messages')
        .getByRole('button', { name: '查看修订前设计与结果', exact: true })
        .click();
      await expect(page.locator('.design-revision-viewer')).toContainText('只读快照');
      await expect(
        page.locator('.design-revision-viewer').getByRole('button', { name: '人工新增', exact: true }),
      ).toHaveCount(0);
    }
  });
