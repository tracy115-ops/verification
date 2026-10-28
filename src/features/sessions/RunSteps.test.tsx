// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { fixtureRun } from '../../domain/runtime/fixtures.test-support';
import { RunSteps } from './RunSteps';

afterEach(cleanup);
it('shows workflow stages and expands the stage containing the failed node', () => {
  const run = fixtureRun();
  const node = run.plan.find((item) => item.operation === 'scenarios.design')!;
  run.steps[node.id].status = 'failed';
  const view = render(<RunSteps run={run} />);
  expect(view.container.querySelectorAll('.session-flow-stage')).toHaveLength(3);
  const current = view.container.querySelector('.session-flow-stage.is-current') as HTMLDetailsElement;
  expect(current.open).toBe(true);
  expect(current.textContent).toContain('因子与场景设计');
  expect(current.textContent).toContain('失败');
});
