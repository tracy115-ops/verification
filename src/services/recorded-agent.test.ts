import { afterEach, expect, it, vi } from 'vitest';
import { recordedAgent } from './recorded-agent';
import { TranscriptStore } from './transcript-store';
import { isCliTurnRecord, type CliTurnRecord, type TranscriptRepository } from '../domain/runtime/transcript';
import type { AgentPort, TurnRequest } from '../domain/runtime/types';
import { fixtureRun } from '../domain/runtime/fixtures.test-support';

afterEach(() => vi.useRealTimers());

it('preserves the final safe progress snapshot on timeout and restores it without inventing text', async () => {
  const repository = memoryRepository();
  const store = new TranscriptStore(repository);
  const submitted = request();
  const progress = {
    elapsedMs: 600013,
    inputWritten: true,
    lastOutputAgeMs: 595393,
    protocolRecords: 5,
    publicTextBytes: 0,
  };
  const base: AgentPort = {
    cancel: async () => {},
    async send(_, emit) {
      emit({ type: 'progress', progress });
      return { status: 'timed_out', text: '', errorCode: 'cli_timeout_after_init', nativeSessionId: null };
    },
  };
  await recordedAgent(base, undefined, store).send(submitted, () => {}, new AbortController().signal);
  await store.flush();
  const restored = new TranscriptStore(repository);
  await restored.load(submitted.sessionId);
  const record = restored.getSnapshot().records[0];
  expect(record.progress).toEqual(progress);
  expect(record.text).toBe('');
  expect(record.status).toBe('timed_out');
  expect(isCliTurnRecord({ ...record, progress: { ...progress, reason: 'private' } })).toBe(false);
});
function memoryRepository(): TranscriptRepository & { records: Map<string, CliTurnRecord> } {
  const records = new Map<string, CliTurnRecord>();
  return {
    records,
    async save(record) {
      if (!isCliTurnRecord(record)) throw new Error('transcript_invalid');
      records.set(record.id, structuredClone(record));
    },
    async readSession(id) {
      return [...records.values()]
        .filter((record) => record.sessionId === id)
        .map((record) => structuredClone(record));
    },
    async removeSession(id) {
      for (const [key, record] of records) if (record.sessionId === id) records.delete(key);
    },
  };
}
function request(): TurnRequest {
  return {
    turnId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    driver: 'codex',
    model: 'fixture-model',
    prompt: JSON.stringify({ operation: 'requirements.extract', input: 'Actual fixture input' }),
    timeoutSeconds: 60,
  };
}

it('retains exactly the request, public reply and validation failure without inventing activity', async () => {
  const repository = memoryRepository();
  const store = new TranscriptStore(repository);
  const submitted = request();
  const base: AgentPort = {
    async send(received, event) {
      expect(received).toEqual(submitted);
      event({ type: 'heartbeat' });
      event({ type: 'text', text: 'public reply' });
      return { status: 'completed', text: 'public reply', errorCode: null, nativeSessionId: null };
    },
    async cancel() {},
  };
  const run = fixtureRun();
  await recordedAgent(base, run, store).send(submitted, () => {}, new AbortController().signal);
  store.validation(submitted.turnId, 'artifact_invalid');
  const stored = store.getSnapshot().records[0];
  expect(stored.request).toEqual(submitted);
  expect(stored.text).toBe('public reply');
  expect(stored.activities).toEqual([]);
  expect(stored.status).toBe('completed');
  expect(stored.validationError).toBe('artifact_invalid');
  expect(stored.runId).toBe(run.id);
  const restored = new TranscriptStore(repository);
  await restored.load(submitted.sessionId);
  expect(restored.getSnapshot().records[0]).toEqual(stored);
});

it('checkpoints partial output and settles cancellation, then deletes its persisted records', async () => {
  vi.useFakeTimers();
  const repository = memoryRepository();
  const store = new TranscriptStore(repository);
  const submitted = request();
  const controller = new AbortController();
  const base: AgentPort = {
    async send(_request, event, signal) {
      event({ type: 'text', text: 'partial output' });
      return new Promise((resolve) =>
        signal.addEventListener(
          'abort',
          () =>
            resolve({
              status: 'cancelled',
              text: 'partial output',
              errorCode: 'cancelled',
              nativeSessionId: null,
            }),
          { once: true },
        ),
      );
    },
    async cancel() {},
  };
  const pending = recordedAgent(base, undefined, store).send(submitted, () => {}, controller.signal);
  await vi.advanceTimersByTimeAsync(251);
  expect(repository.records.get(submitted.turnId)?.text).toBe('partial output');
  const reloaded = new TranscriptStore(repository);
  await reloaded.load(submitted.sessionId);
  expect(reloaded.getSnapshot().records[0].status).toBe('interrupted');
  controller.abort();
  await pending;
  expect(repository.records.get(submitted.turnId)?.status).toBe('cancelled');
  await store.removeSession(submitted.sessionId);
  expect(repository.records.size).toBe(0);
  expect(store.getSnapshot().records).toHaveLength(0);
});

it('rejects corrupt transcript events without throwing during boundary validation', () => {
  const submitted = request();
  const record = {
    version: 1,
    id: submitted.turnId,
    sessionId: submitted.sessionId,
    operation: 'conversation',
    request: submitted,
    startedAt: new Date().toISOString(),
    status: 'completed',
    text: '',
    activities: [],
  };
  expect(isCliTurnRecord(record)).toBe(true);
  expect(isCliTurnRecord({ ...record, activities: [null] })).toBe(false);
  expect(isCliTurnRecord({ ...record, request: null })).toBe(false);
  expect(isCliTurnRecord({ ...record, request: { ...submitted, sessionId: 'other' } })).toBe(false);
});

it('retains failed CLI status separately from artifact rejection and reports storage failures', async () => {
  const repository = memoryRepository();
  const store = new TranscriptStore(repository);
  const submitted = request();
  const port: AgentPort = {
    async send(_request, event) {
      event({ type: 'text', text: 'partial reply' });
      return { status: 'timed_out', text: '', errorCode: 'timeout', nativeSessionId: null };
    },
    async cancel() {},
  };
  await recordedAgent(port, undefined, store).send(submitted, () => {}, new AbortController().signal);
  store.validation(submitted.turnId, 'artifact_invalid');
  expect(store.getSnapshot().records[0]).toMatchObject({
    status: 'timed_out',
    errorCode: 'timeout',
    text: 'partial reply',
  });
  expect(store.getSnapshot().records[0].validationError).toBeUndefined();
  const unavailable = new TranscriptStore({
    ...repository,
    async readSession() {
      throw new Error('offline');
    },
  });
  await unavailable.load(submitted.sessionId);
  expect(unavailable.getSnapshot()).toEqual({ records: [], error: 'transcript_unavailable' });
});
