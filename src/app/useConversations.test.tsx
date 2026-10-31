// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useConversations } from './useConversations';
import { fixturePort, savedDocument, spec } from '../domain/runtime/fixtures.test-support';
import type { AgentPort, TurnOutcome } from '../domain/runtime/types';
import { CONVERSATIONS_KEY } from '../services/conversation-repository';
import { verificationPorts } from '../domain/execution/fixtures.test-support';
import { exampleFramework } from '../domain/execution/presets';
import { requirements } from '../domain/runtime/fixtures.test-support';
import type { CliProgress } from '../domain/runtime/cli-progress';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it('acknowledges a saved message before the CLI finishes and keeps rejected input unaccepted', async () => {
  const saved = savedDocument();
  let finish!: (outcome: TurnOutcome) => void;
  let accepted = 0;
  const port: AgentPort = {
    cancel: async () => {},
    send: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  };
  const { result } = renderHook(() => useConversations(saved.profiles, saved, port));
  let sent!: Promise<boolean>;
  act(() => {
    result.current.newSession();
  });
  await act(async () => {
    expect(
      await result.current.send('', false, 'codex-native', undefined, false, 'recent', () => {
        accepted++;
      }),
    ).toBe(false);
  });
  expect(accepted).toBe(0);
  act(() => {
    sent = result.current.send('hello', false, 'codex-native', undefined, false, 'recent', () => {
      accepted++;
    });
  });
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  expect(accepted).toBe(1);
  expect(result.current.busy).toBe(true);
  await act(async () => {
    finish({ status: 'completed', text: 'hello back', errorCode: null, nativeSessionId: null });
    expect(await sent).toBe(true);
  });
  expect(accepted).toBe(1);
});

it('runs two sessions concurrently and isolates streams, cancellation and final replies', async () => {
  const saved = savedDocument();
  const pending = new Map<
    string,
    {
      emit: (text: string) => void;
      progress: (value: CliProgress) => void;
      finish: () => void;
      signal: AbortSignal;
    }
  >();
  const port: AgentPort = {
    async cancel() {},
    send: (request, emit, signal) =>
      new Promise((resolve) => {
        pending.set(request.sessionId, {
          signal,
          emit: (text) => emit({ type: 'text', text }),
          progress: (progress) => emit({ type: 'progress', progress }),
          finish: () =>
            resolve({
              status: 'completed',
              text: request.prompt.includes('second') ? 'second reply' : 'first reply',
              errorCode: null,
              nativeSessionId: null,
            }),
        });
        signal.addEventListener(
          'abort',
          () =>
            resolve({
              status: 'cancelled',
              text: 'cancelled first',
              errorCode: 'cancelled',
              nativeSessionId: null,
            }),
          { once: true },
        );
      }),
  };
  const { result } = renderHook(() => useConversations(saved.profiles, saved, port));
  let first!: Promise<boolean>, second!: Promise<boolean>;
  act(() => {
    result.current.newSession();
  });
  const firstId = result.current.activeId;
  act(() => {
    first = result.current.send('first', false, 'codex-native');
  });
  await waitFor(() => expect(pending.has(firstId)).toBe(true));
  act(() => {
    result.current.newSession();
  });
  const secondId = result.current.activeId;
  expect(result.current.busy).toBe(false);
  expect(result.current.anyBusy).toBe(true);
  act(() => {
    second = result.current.send('second', false, 'codex-native');
  });
  await waitFor(() => expect(pending.size).toBe(2));
  act(() => {
    pending.get(firstId)!.emit('first stream');
    pending.get(secondId)!.emit('second stream');
    pending.get(firstId)!.progress({
      elapsedMs: 30000,
      inputWritten: true,
      lastOutputAgeMs: 25000,
      protocolRecords: 5,
      publicTextBytes: 0,
    });
    pending.get(secondId)!.progress({
      elapsedMs: 15000,
      inputWritten: true,
      lastOutputAgeMs: 0,
      protocolRecords: 10,
      publicTextBytes: 20,
    });
  });
  expect(result.current.stream).toBe('second stream');
  expect(result.current.progress?.elapsedMs).toBe(15000);
  act(() => {
    result.current.setActiveId(firstId);
  });
  expect(result.current.stream).toBe('first stream');
  expect(result.current.progress?.elapsedMs).toBe(30000);
  await act(async () => {
    result.current.cancel();
    await first;
  });
  expect(pending.get(secondId)!.signal.aborted).toBe(false);
  expect(result.current.anyBusy).toBe(true);
  act(() => {
    result.current.setActiveId(secondId);
  });
  await act(async () => {
    pending.get(secondId)!.finish();
    await second;
  });
  expect(result.current.session!.messages.at(-1)?.text).toBe('second reply');
  expect(result.current.sessions.find((item) => item.id === firstId)!.messages.at(-1)?.text).toBe(
    'cancelled first',
  );
  expect(result.current.anyBusy).toBe(false);
  expect(result.current.progress).toBeUndefined();
});

it('saves clarification within the same run and preserves it after reload', async () => {
  const doc = savedDocument();
  const { port } = fixturePort({ ...requirements, questions: ['Need a rule?'] });
  const hook = renderHook(() => useConversations(doc.profiles, doc, port));
  await act(async () => {
    await hook.result.current.send(spec, true, 'codex-native');
  });
  const run = hook.result.current.session!.runs[0];
  const node = run.plan.find((item) => item.operation === 'review.requirements')!;
  await act(async () => {
    await hook.result.current.clarify(run, node.id, run.steps[node.id].reviewDigest!, {
      'Need a rule?': 'Only the explicit rule applies.',
    });
  });
  expect(hook.result.current.session!.runs[0].clarifications?.[0].answer).toBe(
    'Only the explicit rule applies.',
  );
  hook.unmount();
  const restored = renderHook(() => useConversations(doc.profiles, doc, port));
  expect(restored.result.current.session!.runs[0].clarifications?.[0].question).toBe('Need a rule?');
});

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
