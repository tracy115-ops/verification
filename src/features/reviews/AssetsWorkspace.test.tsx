// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { AssetsWorkspace } from './AssetsWorkspace';
import { fixtureRun, requirements, design, cases } from '../../domain/runtime/fixtures.test-support';
import type { ConversationSession } from '../../domain/runtime/types';

afterEach(cleanup);
it('switches between runs and searches only their own approved artifacts', () => {
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
  render(<AssetsWorkspace sessions={sessions} />);
  expect(within(document.querySelector('.assets-list') as HTMLElement).getByText('other task')).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: first.id } });
  expect(screen.queryByText('other task')).toBeNull();
  expect(screen.getByText('已确认')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '测试因子' }));
  expect(within(document.querySelector('.assets-list') as HTMLElement).getByText('F-1')).toBeTruthy();
  expect(screen.getByText('因子水平')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '测试用例' }));
  expect(within(document.querySelector('.assets-list') as HTMLElement).getByText('TC-1')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'no-match' } });
  expect(screen.getByText('没有匹配条目')).toBeTruthy();
});
