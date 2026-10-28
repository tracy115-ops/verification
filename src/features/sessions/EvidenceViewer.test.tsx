// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { EvidenceViewer } from './EvidenceViewer';
import { fixtureRun } from '../../domain/runtime/fixtures.test-support';
import type { EvidenceBundle } from '../../domain/execution/types';

afterEach(cleanup);
it('filters failed methods and shows only evidence attributable to the selected method', () => {
  const evidence: EvidenceBundle = {
    executionId: 'fixture',
    planDigest: 'fixture',
    rawEvidenceSha256: 'fixture',
    resultSha256: 'fixture',
    workspaceId: 'fixture',
    results: [
      { testName: 'test_bad', status: 'failed', details: ['201 != 400'] },
      { testName: 'test_good', status: 'passed', details: [] },
    ],
    requests: [
      {
        test: 'module.Tests.test_bad',
        request: { method: 'POST', path: '/rooms' },
        response: { status: 201 },
      },
      {
        test: 'module.Tests.test_good',
        request: { method: 'GET', path: '/private' },
        response: { status: 200 },
      },
    ],
  };
  const view = render(<EvidenceViewer evidence={evidence} run={fixtureRun()} />);
  expect(view.container.querySelectorAll('.assets-item')).toHaveLength(1);
  expect(view.getByText('POST /rooms')).toBeTruthy();
  expect(view.queryByText('GET /private')).toBeNull();
  fireEvent.click(view.getByRole('checkbox', { name: '仅看断言失败' }));
  expect(view.container.querySelectorAll('.assets-item')).toHaveLength(2);
  fireEvent.click(view.getByRole('button', { name: /test_good/ }));
  expect(view.getByText('GET /private')).toBeTruthy();
  expect(view.queryByText('POST /rooms')).toBeNull();
});
