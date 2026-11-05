// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { fixtureRun } from '../../domain/runtime/fixtures.test-support';
import { AnalysisBudgetSummary } from './AnalysisBudgetSummary';
import { RunState } from './RunSummary';
import { AnalysisRetryControls } from './AnalysisRetryControls';
import type { Conversations } from '../../app/useConversations';
vi.mock('../../services/agent-api', () => ({ hasDesktopBridge: () => true }));
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

it('previews draft requirements before design starts and forwards a custom continuation budget', () => {
  const run = fixtureRun();
  const node = run.plan.find((item) => item.operation === 'scenarios.design')!;
  run.artifacts.draft = {
    type: 'RequirementBaselineDraft',
    digest: 'a'.repeat(64),
    value: {
      requirements: [
        { id: 'R1', text: 'Defined rule', quote: 'Defined rule', acceptanceCriteria: ['defined'] },
      ],
      questions: [],
    },
  };
  const retry = vi.fn();
  run.status = 'interrupted';
  run.errorCode = 'analysis_budget_paused';
  run.steps[node.id].status = 'interrupted';
  render(
    <>
      <AnalysisBudgetSummary run={run} />
      <AnalysisRetryControls run={run} actions={{ retry, busy: false } as unknown as Conversations} />
    </>,
  );
  expect(screen.getByText(/按当前需求预估/)).toBeTruthy();
  expect(screen.getByText('已完成 0 / 1 个计划批次')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('本轮最多调用批次'), { target: { value: '4' } });
  fireEvent.click(screen.getByText('继续下一批分析'));
  expect(retry).toHaveBeenCalledWith(run, false, undefined, 4);
  cleanup();
  run.steps[node.id].status = 'succeeded';
  render(<AnalysisBudgetSummary run={run} />);
  expect(screen.queryByText('设计分析预算')).toBeNull();
});
