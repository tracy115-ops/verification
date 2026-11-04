import { advanceRun, approveRun } from './engine';
import { design, fixturePort, fixtureRun } from './fixtures.test-support';
import type { DesignPatch } from './design-proposal-schema';

export async function completedProposalRun() {
  let run = fixtureRun();
  for (let i = 0; i < 3; i++) {
    run = await advanceRun(
      run,
      fixturePort().port,
      new AbortController().signal,
      () => {},
      () => {},
    );
    const node = run.plan.find((item) => run.steps[item.id].status === 'awaiting_review')!;
    run = await approveRun(run, node.id, run.steps[node.id].reviewDigest!);
  }
  return advanceRun(
    run,
    fixturePort().port,
    new AbortController().signal,
    () => {},
    () => {},
  );
}
export const addedScenarioPatch: DesignPatch = {
  summary: '补充独立状态场景',
  factors: [],
  questions: [],
  scenarios: [{ action: 'add', value: { ...design.scenarios[0], id: 'SC-2', title: '独立核对锁定结果' } }],
};
