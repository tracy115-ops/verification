// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useConversations } from './useConversations';
import { fixturePort, savedDocument, spec } from '../domain/runtime/fixtures.test-support';
import type { AgentPort, TurnOutcome } from '../domain/runtime/types';
import { CONVERSATIONS_KEY } from '../services/conversation-repository';
import { verificationPorts } from '../domain/execution/fixtures.test-support';
import { exampleFramework } from '../domain/execution/presets';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it('persists the full workflow and keeps Python behind the fourth approval', async () => {
  const saved = savedDocument();
  const ports = verificationPorts();
  const { result } = renderHook(() => useConversations(saved.profiles, saved, ports.agent, ports.execution));
  await act(async () => {
    await result.current.send(spec, true, 'codex-native', exampleFramework());
  });
  for (let gate = 0; gate < 4; gate++) {
    expect(ports.calls).not.toContain('targets.execute');
    const run = result.current.session!.runs[0];
    const node = run.plan.find((item) => run.steps[item.id].status === 'awaiting_review')!;
    await act(async () => {
      await result.current.approve(run, node.id, run.steps[node.id].reviewDigest!);
    });
  }
  expect(result.current.session!.runs[0].status).toBe('completed');
  const persisted = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY)!)[0].runs[0];
  expect(persisted.scope).toBe('verification');
  expect(persisted.approvals).toHaveLength(4);
  expect(
    Object.values(persisted.artifacts).some(
      (item: unknown) => (item as { type: string }).type === 'EvidenceBundle',
    ),
  ).toBe(true);
});

it('invokes the saved workflow through the session and persists each human gate', async () => {
  const saved = savedDocument();
  const { port, requests } = fixturePort();
  const { result } = renderHook(() => useConversations(saved.profiles, saved, port));
  await act(async () => {
    expect(await result.current.send(spec, true, 'codex-native')).toBe(true);
  });
  expect(requests).toHaveLength(1);
  expect(result.current.session?.runs[0].status).toBe('awaiting_review');
  for (let index = 0; index < 3; index++) {
    const run = result.current.session!.runs[0];
    const node = run.plan.find((node) => run.steps[node.id].status === 'awaiting_review')!;
    await act(async () => {
      await result.current.approve(run, node.id, run.steps[node.id].reviewDigest!);
    });
  }
  expect(result.current.session?.runs[0].status).toBe('completed');
  expect(JSON.parse(localStorage.getItem(CONVERSATIONS_KEY)!)[0].runs[0].approvals).toHaveLength(3);
});

it('rejects double sends while streaming and passes cancellation to the active CLI call', async () => {
  const saved = savedDocument();
  let calls = 0;
  const port: AgentPort = {
    async cancel() {},
    send: async (_request, emit, signal) => {
      calls++;
      emit({ type: 'text', text: 'partial' });
      return new Promise<TurnOutcome>((resolve) =>
        signal.addEventListener(
          'abort',
          () =>
            resolve({ status: 'cancelled', text: 'partial', errorCode: 'cancelled', nativeSessionId: null }),
          { once: true },
        ),
      );
    },
  };
  const { result } = renderHook(() => useConversations(saved.profiles, saved, port));
  let pending: Promise<boolean>;
  act(() => {
    pending = result.current.send('hello', false, 'codex-native');
  });
  await waitFor(() => expect(result.current.stream).toBe('partial'));
  await act(async () => {
    expect(await result.current.send('duplicate', false, 'codex-native')).toBe(false);
  });
  await act(async () => {
    result.current.cancel();
    await pending;
  });
  expect(calls).toBe(1);
  expect(result.current.busy).toBe(false);
  expect(result.current.session?.activeTurnId).toBeUndefined();
});

it('preserves corrupt history and keeps preflight-rejected text unsent', async () => {
  localStorage.setItem(CONVERSATIONS_KEY, 'original-invalid');
  const doc = savedDocument();
  const { port, requests } = fixturePort();
  const { result } = renderHook(() => useConversations(doc.profiles, null, port));
  expect(result.current.error).toBe('session_storage_invalid');
  await act(async () => {
    expect(await result.current.send(spec, true, 'codex-native')).toBe(false);
  });
  expect(requests).toHaveLength(0);
  expect(localStorage.getItem(CONVERSATIONS_KEY)).toBe('original-invalid');
});
