import { expect, it } from 'vitest';
import { isCliProgress, progressPhase } from './cli-progress';

const snapshot = {
  elapsedMs: 600013,
  inputWritten: true,
  lastOutputAgeMs: 595393,
  protocolRecords: 5,
  publicTextBytes: 0,
};

it('keeps initialization without text distinct from a public reply', () => {
  expect(isCliProgress(snapshot)).toBe(true);
  expect(progressPhase(snapshot)).toBe('cliProgressQuiet');
  expect(progressPhase(snapshot, false, true)).toBe('cliProgressStatus');
  expect(progressPhase({ ...snapshot, lastOutputAgeMs: 0 })).toBe('cliProgressActiveWithoutReply');
  expect(progressPhase({ ...snapshot, lastOutputAgeMs: null, protocolRecords: 0 })).toBe(
    'cliProgressWritten',
  );
  expect(progressPhase({ ...snapshot, lastOutputAgeMs: null, protocolRecords: 0, inputWritten: false })).toBe(
    'cliProgressStarting',
  );
  expect(progressPhase({ ...snapshot, lastOutputAgeMs: 0, publicTextBytes: 10 })).toBe('cliProgressReply');
  expect(progressPhase(snapshot, true)).toBe('cliProgressReply');
  expect(progressPhase({ ...snapshot, publicTextBytes: 10 })).toBe('cliProgressReplyQuiet');
});

it('rejects corrupt counters and unexpected diagnostic payloads at the boundary', () => {
  for (const value of [
    null,
    [],
    { ...snapshot, elapsedMs: -1 },
    { ...snapshot, lastOutputAgeMs: Infinity },
    { ...snapshot, protocolRecords: 1.5 },
    { ...snapshot, publicTextBytes: Number.MAX_SAFE_INTEGER + 1 },
    { ...snapshot, reason: 'private data' },
    { ...snapshot, inputWritten: 'true' },
  ])
    expect(isCliProgress(value)).toBe(false);
});
