// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { fixtureRun, requirements } from '../../domain/runtime/fixtures.test-support';
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

it('opens the artifact produced by the selected stage without dumping its contents into the sidebar', () => {
  const run = fixtureRun();
  const node = run.plan.find((item) => item.operation === 'review.requirements')!;
  const key = `${node.id}.${Object.keys(node.outputs)[0]}`;
  run.artifacts[key] = { type: 'RequirementBaseline', value: requirements, digest: 'fixture' };
  run.steps[node.id].status = 'succeeded';
  const openArtifact = vi.fn();
  const view = render(<RunSteps run={run} openArtifact={openArtifact} />);
  fireEvent.click(view.getByRole('button', { name: '查看需求理解产物' }));
  expect(openArtifact).toHaveBeenCalledWith(key);
  expect(
    [...view.container.querySelectorAll<HTMLDetailsElement>('.session-flow-stage')].some(
      (stage) => stage.open,
    ),
  ).toBe(false);
  expect(view.container.querySelector('.session-artifact')).toBeNull();
  expect(view.queryByText(requirements.requirements[0].quote)).toBeNull();
});
