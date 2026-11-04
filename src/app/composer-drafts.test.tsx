// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useConversations } from './useConversations';
import { fixturePort, savedDocument } from '../domain/runtime/fixtures.test-support';
import type { AgentPort, TurnOutcome } from '../domain/runtime/types';
import { decodeConversations } from '../services/conversation-repository';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it('restores each draft, flow, framework and context after switching and reload', () => {
  const doc = savedDocument();
  const useApp = () => useConversations(doc.profiles, doc, fixturePort().port);
  const app = renderHook(useApp);
  act(() =>
    app.result.current.updateComposerDraft(
      {
        text: '未发送的需求',
        invoke: true,
        frameworkId: 'orders',
        useNodeBindings: true,
        contextMode: 'current',
      },
      'codex-native',
    ),
  );
  const first = app.result.current.activeId;
  act(() => app.result.current.newSession());
  act(() =>
    app.result.current.updateComposerDraft(
      { text: '另一份草稿', profileId: 'claude-native' },
      'codex-native',
    ),
  );
  const second = app.result.current.activeId;
  act(() => app.result.current.setActiveId(first));
  expect(app.result.current.session?.draft).toMatchObject({
    text: '未发送的需求',
    invoke: true,
    frameworkId: 'orders',
    useNodeBindings: true,
    contextMode: 'current',
  });
  app.unmount();
  const restored = renderHook(useApp);
  expect(restored.result.current.activeId).toBe(first);
  expect(restored.result.current.session?.draft?.text).toBe('未发送的需求');
  act(() => restored.result.current.setActiveId(second));
  expect(restored.result.current.session?.draft).toMatchObject({
    text: '另一份草稿',
    profileId: 'claude-native',
  });
  act(() => {
    expect(restored.result.current.deleteSession(second)).toBe(true);
  });
  expect(restored.result.current.sessions.some((session) => session.id === second)).toBe(false);
});

it('preserves a new draft and choices when an older background reply settles', async () => {
  const doc = savedDocument();
  let finish!: (value: TurnOutcome) => void;
  const port: AgentPort = {
    cancel: async () => {},
    send: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  };
  const app = renderHook(() => useConversations(doc.profiles, doc, port));
  act(() => app.result.current.updateComposerDraft({ text: '已提交消息' }, 'codex-native'));
  const first = app.result.current.activeId;
  let sent!: Promise<boolean>;
  act(() => {
    sent = app.result.current.send('已提交消息', false, 'codex-native');
  });
  expect(app.result.current.session?.draft?.text).toBe('');
  act(() =>
    app.result.current.updateComposerDraft(
      { text: '正在起草的下一条', contextMode: 'current' },
      'codex-native',
    ),
  );
  act(() => app.result.current.newSession());
  act(() => app.result.current.updateComposerDraft({ text: '其他会话不能被清除' }, 'codex-native'));
  await act(async () => {
    finish({ status: 'completed', text: '迟到的回复', errorCode: null, nativeSessionId: null });
    expect(await sent).toBe(true);
  });
  expect(app.result.current.session?.draft?.text).toBe('其他会话不能被清除');
  act(() => app.result.current.setActiveId(first));
  expect(app.result.current.session?.draft).toMatchObject({
    text: '正在起草的下一条',
    contextMode: 'current',
  });
  expect(app.result.current.session?.messages.at(-1)?.text).toBe('迟到的回复');
});

it('retains rejected drafts and validates imported draft boundaries', async () => {
  const doc = savedDocument();
  const app = renderHook(() => useConversations(doc.profiles, null, fixturePort().port));
  act(() => app.result.current.updateComposerDraft({ text: '未通过前置校验', invoke: true }, 'codex-native'));
  await act(async () => {
    expect(await app.result.current.send('未通过前置校验', true, 'codex-native')).toBe(false);
  });
  expect(app.result.current.session?.draft?.text).toBe('未通过前置校验');
  const session = structuredClone(app.result.current.session!);
  session.draft!.contextMode = 'invalid' as never;
  expect(() => decodeConversations([session])).toThrow('session_storage_invalid');
  session.draft!.contextMode = 'recent';
  session.draft!.text = 'x'.repeat(40001);
  expect(() => decodeConversations([session])).toThrow('session_storage_invalid');
});
