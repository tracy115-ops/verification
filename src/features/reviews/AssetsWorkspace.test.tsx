// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { AssetsWorkspace } from './AssetsWorkspace';
import { fixtureRun, requirements, design, cases } from '../../domain/runtime/fixtures.test-support';
import type { ConversationSession } from '../../domain/runtime/types';

afterEach(cleanup);
it('shows only the current conversation and searches its approved artifacts', () => {
  const first = fixtureRun();
  first.artifacts = {
    a: { type: 'RequirementBaselineDraft', value: requirements, digest: 'draft' },
    b: { type: 'RequirementBaseline', value: requirements, digest: 'approved' },
    c: { type: 'TestDesign', value: design, digest: 'design' },
    d: { type: 'TestCaseSet', value: cases, digest: 'cases' },
  };
  const second = fixtureRun();
  second.artifacts = {
    a: {
      type: 'RequirementBaseline',
      value: {
        requirements: [{ ...requirements.requirements[0], id: 'REQ-2', text: 'other task' }],
        questions: [],
      },
      digest: 'other',
    },
  };
  const sessions: ConversationSession[] = [
    { id: first.sessionId, title: 'first', profileId: 'codex-native', messages: [], runs: [first] },
    { id: second.sessionId, title: 'second', profileId: 'codex-native', messages: [], runs: [second] },
  ];
  const { rerender } = render(
    <AssetsWorkspace key={sessions[0].id} session={sessions[0]} openSession={() => {}} />,
  );
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.queryByText('other task')).toBeNull();
  expect(screen.getByText('已确认')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '测试因子' }));
  expect(within(document.querySelector('.assets-list') as HTMLElement).getByText('F-1')).toBeTruthy();
  expect(screen.getByText('因子水平')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /^REQ-1$/ }));
  fireEvent.click(screen.getByRole('button', { name: 'SC-1 · 第五次失败' }));
  expect(within(document.querySelector('.assets-list') as HTMLElement).getByText('SC-1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'TC-1 · 失败锁定' }));
  expect(within(document.querySelector('.assets-list') as HTMLElement).getByText('TC-1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '测试用例' }));
  expect(within(document.querySelector('.assets-list') as HTMLElement).getByText('TC-1')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: '搜索 ID、标题或关联内容' }), {
    target: { value: 'no-match' },
  });
  expect(screen.getByText('没有匹配条目')).toBeTruthy();
  rerender(<AssetsWorkspace key={sessions[1].id} session={sessions[1]} openSession={() => {}} />);
  expect(within(document.querySelector('.assets-list') as HTMLElement).getByText('other task')).toBeTruthy();
  expect(screen.queryByText('TC-1')).toBeNull();
});

it('opens the selected run from the review panel instead of the newest unrelated run', () => {
  const first = fixtureRun();
  const second = fixtureRun();
  second.sessionId = first.sessionId;
  const session: ConversationSession = {
    id: first.sessionId,
    title: 'one',
    profileId: 'codex-native',
    messages: [],
    runs: [first, second],
  };
  render(<AssetsWorkspace session={session} runId={first.id} openSession={() => {}} />);
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.getByText('历史运行版本')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'one' })).toBeTruthy();
});
