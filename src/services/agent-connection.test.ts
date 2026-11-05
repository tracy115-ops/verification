import { afterEach, expect, it } from 'vitest';
import { checkAgentConnection, connectionFor, invalidateConnections } from './agent-connection';
import { createDocument } from '../domain/document';
import type { AgentPort, TurnOutcome, TurnRequest } from '../domain/runtime/types';
afterEach(() => invalidateConnections([]));
const profile = {
  ...createDocument().profiles.find((item) => item.driver === 'claude')!,
  model: 'fixture-model',
  launch: { executablePath: 'D:\\Claude One\\claude.cmd', configDirectory: 'D:\\Config One' },
};
const result: TurnOutcome = {
  status: 'completed',
  text: 'WORKBENCH_CONNECTION_OK',
  errorCode: null,
  nativeSessionId: null,
};

it('uses the saved instance, isolated session and model and invalidates changed configuration', async () => {
  let request: TurnRequest | undefined;
  const port: AgentPort = {
    send: async (input) => {
      request = input;
      return result;
    },
    cancel: async () => {},
  };
  await checkAgentConnection(profile, port, new AbortController().signal);
  expect(request?.launch).toEqual(profile.launch);
  expect(request?.model).toBe(profile.model);
  expect(request?.timeoutSeconds).toBe(60);
  expect(connectionFor(profile)?.status).toBe('passed');
  invalidateConnections([{ ...profile, model: 'changed' }]);
  expect(connectionFor(profile)).toBeUndefined();
});

it('does not certify errors or arbitrary terminal text as successful inference', async () => {
  for (const outcome of [
    { ...result, text: 'Not logged in', status: 'failed' as const, errorCode: 'cli_auth_failed' },
    { ...result, text: 'unrelated' },
  ]) {
    await checkAgentConnection(
      profile,
      { send: async () => outcome, cancel: async () => {} },
      new AbortController().signal,
    );
    expect(connectionFor(profile)?.status).toBe('failed');
    expect(connectionFor(profile)?.errorCode).toBe(outcome.errorCode ?? 'cli_test_reply_invalid');
  }
});

it('ignores a late success after configuration invalidation', async () => {
  let finish!: (outcome: TurnOutcome) => void;
  const pending = checkAgentConnection(
    profile,
    {
      send: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      cancel: async () => {},
    },
    new AbortController().signal,
  );
  expect(connectionFor(profile)?.status).toBe('checking');
  invalidateConnections([]);
  finish(result);
  await pending;
  expect(connectionFor(profile)).toBeUndefined();
});

it('honors cancellation even if the CLI races with a terminal success', async () => {
  const controller = new AbortController();
  await checkAgentConnection(
    profile,
    {
      send: async () => {
        controller.abort();
        return result;
      },
      cancel: async () => {},
    },
    controller.signal,
  );
  expect(connectionFor(profile)?.errorCode).toBe('cancelled');
});
