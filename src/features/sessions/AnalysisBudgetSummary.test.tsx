// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { fixtureRun } from '../../domain/runtime/fixtures.test-support';
import { AnalysisBudgetSummary } from './AnalysisBudgetSummary';
import { RunState } from './RunSummary';
afterEach(cleanup);

it('shows pending relationships and a budget pause without claiming design completion', () => {
  const run = fixtureRun();
  const node = run.plan.find((item) => item.operation === 'scenarios.design')!;
  run.status = 'interrupted';
  run.errorCode = 'analysis_budget_paused';
  run.steps[node.id].analysis = {
    version: 1,
    kind: 'design',
    signature: 'a'.repeat(64),
    total: 3,
    localTotal: 2,
    completed: [],
  };
  run.artifacts.baseline = {
    type: 'RequirementBaseline',
    digest: 'b'.repeat(64),
    value: {
      requirements: ['R1', 'R2'].map((id) => ({
        id,
        text: 'a'.repeat(5800),
        quote: id,
        acceptanceCriteria: ['defined'],
      })),
      questions: [],
    },
  };
  render(
    <>
      <RunState run={run} />
      <AnalysisBudgetSummary run={run} />
    </>,
  );
  expect(screen.getByText('分析预算暂停')).toBeTruthy();
  expect(screen.getByText('已完成 0 / 3 个计划批次')).toBeTruthy();
  expect(screen.getByText('R1 ↔ R2')).toBeTruthy();
  expect(screen.getByText(/每次继续最多调用 16/)).toBeTruthy();
});
