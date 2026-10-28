// @vitest-environment jsdom
import { cleanup, render, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { fixtureRun } from '../../domain/runtime/fixtures.test-support';
import type { Conversations } from '../../app/useConversations';
import { RunPanel } from './RunPanel';

afterEach(cleanup);
it('shows actual candidate and error counts above the workflow steps', () => {
  const run = fixtureRun();
  run.status = 'completed';
  run.artifacts.report = {
    type: 'VerificationReport',
    digest: 'test',
    value: {
      status: 'inconclusive',
      counts: { passed: 4, failed: 1, error: 2, skipped: 0 },
      candidates: [],
      notes: [],
      action: 'repair_test_environment',
      policy: 'report_only',
      evidenceDigest: 'a'.repeat(64),
    },
  };
  const { container } = render(<RunPanel run={run} actions={{ busy: false } as Conversations} />);
  const summary = container.querySelector('.session-result-summary')!;
  expect(within(summary as HTMLElement).getByText('存在无法判定项')).toBeTruthy();
  expect(summary.textContent).toContain('执行错误: 2');
  expect(
    summary.compareDocumentPosition(container.querySelector('.session-step-list')!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
