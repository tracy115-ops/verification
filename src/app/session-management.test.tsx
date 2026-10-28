// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useConversations } from './useConversations';
import { fixturePort, savedDocument } from '../domain/runtime/fixtures.test-support';
import { createSession } from '../domain/runtime/chat';
import { CONVERSATIONS_KEY } from '../services/conversation-repository';
import type { AgentPort, TurnOutcome } from '../domain/runtime/types';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it('rejects empty names and refuses to delete a recovered CLI turn', () => {
  const session = createSession('codex-native');
  session.activeTurnId = crypto.randomUUID();
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify([session]));
  const doc = savedDocument();
  const { result } = renderHook(() => useConversations(doc.profiles, doc, fixturePort().port));
  act(() => {
    expect(result.current.renameSession(session.id, '  ')).toBe(false);
    expect(result.current.deleteSession(session.id)).toBe(false);
  });
  expect(result.current.sessions).toHaveLength(1);
  expect(result.current.session?.activeTurnId).toBe(session.activeTurnId);
});

it('blocks renaming and deletion while a CLI reply is pending', async () => {
  let settle!: (outcome: TurnOutcome) => void;
  const port: AgentPort = {
    send: () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
    async cancel() {},
  };
  const doc = savedDocument();
  const { result } = renderHook(() => useConversations(doc.profiles, doc, port));
  let pending!: Promise<boolean>;
  await act(async () => {
    pending = result.current.send('Hello', false, 'codex-native');
  });
  const id = result.current.session!.id;
  act(() => {
    expect(result.current.renameSession(id, 'New title')).toBe(false);
    expect(result.current.deleteSession(id)).toBe(false);
  });
  await act(async () => {
    settle({ status: 'completed', text: 'Hi', errorCode: null, nativeSessionId: null });
    await pending;
  });
  expect(result.current.session?.title).toBe('Hello');
  expect(result.current.session?.messages).toHaveLength(2);
});
