import { expect, it } from 'vitest';
import { createSession } from '../domain/runtime/chat';
import { fixtureRun } from '../domain/runtime/fixtures.test-support';
import { decodeConversations, saveConversations } from './conversation-repository';
import { retryRun } from '../domain/runtime/engine';

it('restores incomplete work as interrupted and retains snapshots', () => {
  const session = createSession('codex-native');
  const run = fixtureRun();
  run.sessionId = session.id;
  run.status = 'running';
  run.steps[run.plan[1].id].status = 'running';
  session.runs.push(run);
  const restored = decodeConversations([session]);
  expect(restored[0].runs[0].status).toBe('interrupted');
  expect(restored[0].runs[0].steps[run.plan[1].id].status).toBe('interrupted');
  expect(run.status).toBe('running');
});
it('allows explicit recovery if reload occurred before the first node started', () => {
  const session = createSession('codex-native');
  session.runs.push({ ...fixtureRun(), sessionId: session.id });
  const recovered = decodeConversations([session])[0].runs[0];
  expect(recovered.status).toBe('interrupted');
  expect(retryRun(recovered).status).toBe('ready');
});
it('rejects invalid stored envelopes and substituted execution nodes', () => {
  expect(() => decodeConversations([{ id: 'bad' }])).toThrow('session_storage_invalid');
  const session = createSession('codex-native');
  const run = fixtureRun();
  run.sessionId = session.id;
  session.runs.push(run);
  run.plan[1].policy.timeoutSeconds = 123;
  expect(() => decodeConversations([session])).toThrow();
});

it('rejects cross-session and duplicate identities before overwriting stored data', () => {
  const session = createSession('codex-native');
  const run = { ...fixtureRun(), sessionId: session.id };
  session.runs.push(run);
  const storage = {
    setItem: () => {
      throw new Error('must_not_write');
    },
  };
  for (const invalid of [
    [session, structuredClone(session)],
    [{ ...session, runs: [run, structuredClone(run)] }],
    [{ ...session, runs: [{ ...run, sessionId: 'different-session' }] }],
    [session, { ...createSession('codex-native'), runs: [{ ...run, sessionId: 'different-session' }] }],
  ]) {
    expect(() => decodeConversations(invalid)).toThrow('session_storage_invalid');
    expect(() => saveConversations(storage, invalid)).toThrow('session_storage_invalid');
  }
});
