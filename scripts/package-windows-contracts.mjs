import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packageWithRetry, transientBundleFailure } from './package-windows.mjs';

test('only transient bundle HTTP failures are retried', () => {
  assert.equal(transientBundleFailure('failed to bundle project: `http status: 504`'), true);
  for (const output of [
    'compiler failed: http status: 504',
    'failed to bundle project: invalid icon',
    'failed to bundle project: http status: 401',
  ])
    assert.equal(transientBundleFailure(output), false);
});

test('download retry can recover and is bounded to three builds', async () => {
  let calls = 0;
  const pauses = [];
  const failed = { code: 1, output: 'failed to bundle project: http status: 504' };
  assert.equal(
    await packageWithRetry(
      async () => (++calls === 2 ? { code: 0, output: '' } : failed),
      async (ms) => pauses.push(ms),
    ),
    0,
  );
  assert.equal(calls, 2);
  calls = 0;
  assert.equal(
    await packageWithRetry(
      async () => {
        calls++;
        return failed;
      },
      async () => {},
    ),
    1,
  );
  assert.equal(calls, 3);
  assert.deepEqual(pauses, [10000]);
});

test('compile failures return immediately', async () => {
  let calls = 0;
  assert.equal(
    await packageWithRetry(
      async () => {
        calls++;
        return { code: 7, output: 'compile failed' };
      },
      async () => assert.fail('must not wait'),
    ),
    7,
  );
  assert.equal(calls, 1);
});
