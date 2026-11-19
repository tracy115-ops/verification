import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { reportRunFixture } from '../fixtures/report-run';
import type { EvidenceBundle, ImplementationBundle } from '../../src/domain/execution/types';

for (const variant of ['matching', 'different-execution', 'remapped-cases']) {
  test(`keeps displayed and exported coverage consistent for ${variant}`, async ({ page }) => {
    const run = reportRunFixture();
    const pick = (type: string) => Object.values(run.artifacts).find((item) => item.type === type)!.value;
    if (variant === 'different-execution')
      (pick('EvidenceBundle') as EvidenceBundle).executionId = crypto.randomUUID();
    if (variant === 'remapped-cases') {
      const bundle = pick('ImplementationBundle') as ImplementationBundle;
      [bundle.tests[0].caseIds, bundle.tests[1].caseIds] = [bundle.tests[1].caseIds, bundle.tests[0].caseIds];
    }
    await page.addInitScript((run) => {
      localStorage.setItem(
        'verification-workbench.conversations.v1',
        JSON.stringify([
          {
            id: run.sessionId,
            title: '覆盖与执行关联复验',
            profileId: run.defaultProfileId,
            messages: [],
            runs: [run],
          },
        ]),
      );
      localStorage.setItem('verification-workbench.active-conversation', run.sessionId);
    }, run);
    await page.goto('/');
    await page.getByRole('button', { name: '验证资产', exact: true }).click();
    await page.getByRole('button', { name: '测试用例', exact: true }).click();
    await page.locator('.assets-item').filter({ hasText: 'B1-TC-CAP-2-VALID-201' }).click();
    const coverage = page.locator('.personal-case-coverage');
    await expect(coverage).toContainText(variant === 'matching' ? '本次执行通过' : '尚未执行／无匹配证据');
    await expect(coverage).toContainText(variant === 'remapped-cases' ? '已声明覆盖' : '方法映射已核对');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '导出脚本映射包', exact: true }).click(),
    ]);
    const bundle = JSON.parse(readFileSync((await download.path())!, 'utf8'));
    expect(!!bundle.execution).toBe(variant === 'matching');
    expect(bundle.mappings).toHaveLength(4);
  });
}
