// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useConversations } from '../../app/useConversations';
import { createSession } from '../../domain/runtime/chat';
import { fixtureRun, savedDocument } from '../../domain/runtime/fixtures.test-support';
import type { AgentEvent, AgentPort, TurnOutcome } from '../../domain/runtime/types';
import { CONVERSATIONS_KEY } from '../../services/conversation-repository';
import { ConversationTimeline } from './ConversationTimeline';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it.each([false, true])(
  'shows immediate and streamed feedback with existing workflow = %s',
  async (hasRun) => {
    const saved = savedDocument();
    const session = createSession('codex-native');
    if (hasRun) {
      const run = fixtureRun();
      run.sessionId = session.id;
      run.status = 'cancelled';
      session.runs = [run];
    }
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify([session]));
    let emit: (event: AgentEvent) => void = () => {};
    let finish: (outcome: TurnOutcome) => void = () => {};
    const port: AgentPort = {
      send: (_request, onEvent) => {
        emit = onEvent;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      cancel: async () => {},
    };
    function Harness() {
      const actions = useConversations(saved.profiles, saved, port);
      return (
        <>
          <button onClick={() => void actions.send('你好', false, 'codex-native')}>Send</button>
          <ConversationTimeline
            actions={actions}
            activeRun={actions.session?.runs[0]}
            openAssets={() => {}}
          />
        </>
      );
    }
    const view = render(<Harness />);
    fireEvent.click(screen.getByText('Send'));
    expect(screen.getByRole('status').textContent).toBe('Agent 正在回复');
    expect(view.container.querySelector('.session-pending-reply')?.getAttribute('aria-busy')).toBe('true');
    act(() => emit({ type: 'text', text: '收到，正在分析。' }));
    expect(view.container.querySelector('.session-pending-reply')?.textContent).toContain('收到，正在分析。');
    await act(async () =>
      finish({ status: 'completed', text: '收到，正在分析。', errorCode: null, nativeSessionId: null }),
    );
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.getAllByText('收到，正在分析。')).toHaveLength(1);
  },
);

it.each(['failed', 'cancelled', 'timed_out'] as const)(
  'clears waiting feedback when the CLI is %s',
  async (status) => {
    const saved = savedDocument();
    let finish: (outcome: TurnOutcome) => void = () => {};
    const port: AgentPort = {
      send: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      cancel: async () => {},
    };
    function Harness() {
      const actions = useConversations(saved.profiles, saved, port);
      return (
        <>
          <button onClick={() => void actions.send('你好', false, 'codex-native')}>Send</button>
          <ConversationTimeline actions={actions} openAssets={() => {}} />
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByText('Send'));
    expect(screen.getByRole('status')).toBeTruthy();
    await act(async () => finish({ status, text: '', errorCode: 'cli_failed', nativeSessionId: null }));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  },
);
