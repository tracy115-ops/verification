import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  createQuotaTarget,
  quotaDefects,
  quotaObservationDefect,
} from '../../tests/fixtures/blackbox/quota-target.mjs';
import { loopbackJson } from './loopback-json.mjs';

async function withTarget(defect, check) {
  const server = createQuotaTarget(defect);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  async function call(method, route, body, user = 'player-a') {
    return loopbackJson(`http://127.0.0.1:${server.address().port}${route}`, method, body, user);
  }
  try {
    await check(call);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
for (const defect of [null, ...quotaDefects])
  test(`ordinary journey succeeds: ${defect ?? 'reference'}`, async () => {
    await withTarget(defect, async (call) => {
      assert.deepEqual((await call('GET', '/quota')).body, { available: 4, consumed: 0 });
      const hold = await call('POST', '/holds', { units: 1, key: 'Normal' });
      assert.equal(hold.status, 201);
      assert.equal((await call('POST', `/holds/${hold.body.id}/consume`)).status, 200);
      assert.deepEqual((await call('GET', '/quota')).body, { available: 3, consumed: 1 });
    });
  });
test('reference preserves state on invalid input, replay, forbidden transitions and ownership failures', async () => {
  await withTarget(null, async (call) => {
    for (const units of [true, false, 0, 5, 1.5, '1', null])
      assert.equal((await call('POST', '/holds', { units, key: 'Invalid' })).status, 400);
    for (const key of ['', 'a'.repeat(33), 'not-valid', '中文'])
      assert.equal((await call('POST', '/holds', { units: 1, key })).status, 400);
    assert.equal((await call('GET', '/quota', undefined, null)).status, 401);
    assert.equal((await call('GET', '/holds/missing')).status, 404);
    const first = await call('POST', '/holds', { units: 2, key: 'Shared' });
    const id = first.body.id;
    assert.equal((await call('POST', '/holds', { units: 2, key: 'Shared' })).body.id, id);
    assert.equal((await call('POST', '/holds', { units: 3, key: 'Shared' })).status, 409);
    const other = await call('POST', '/holds', { units: 2, key: 'Shared' }, 'player-b');
    assert.equal(other.status, 201);
    assert.notEqual(other.body.id, id);
    for (const action of ['', '/release', '/consume'])
      assert.equal(
        (await call(action ? 'POST' : 'GET', `/holds/${id}${action}`, undefined, 'player-b')).status,
        403,
      );
    assert.deepEqual((await call('GET', '/quota')).body, { available: 2, consumed: 0 });
    await call('POST', `/holds/${id}/release`);
    await call('POST', `/holds/${id}/release`);
    assert.equal((await call('POST', `/holds/${id}/consume`)).status, 409);
    assert.deepEqual((await call('GET', '/quota')).body, { available: 4, consumed: 0 });
    assert.equal((await call('POST', '/holds', { units: 2, key: 'Shared' })).body.state, 'released');
    const consumed = await call('POST', '/holds', { units: 4, key: 'a'.repeat(32) });
    assert.equal(consumed.status, 201);
    assert.equal((await call('POST', '/holds', { units: 1, key: 'Later' })).status, 409);
    await call('POST', `/holds/${consumed.body.id}/consume`);
    await call('POST', `/holds/${consumed.body.id}/consume`);
    assert.equal((await call('POST', `/holds/${consumed.body.id}/release`)).status, 409);
    assert.deepEqual((await call('GET', '/quota')).body, { available: 0, consumed: 4 });
    assert.equal((await call('POST', '/holds', { units: 4, key: 'a'.repeat(32) })).body.state, 'consumed');
  });
});
test('reference serializes concurrent allocation and repeated terminal actions', async () => {
  await withTarget(null, async (call) => {
    const same = await Promise.all([1, 2].map(() => call('POST', '/holds', { units: 2, key: 'Same' })));
    assert.deepEqual(same.map((r) => r.status).sort(), [200, 201]);
    assert.equal(same[0].body.id, same[1].body.id);
    const id = same[0].body.id;
    await Promise.all([1, 2].map(() => call('POST', `/holds/${id}/release`)));
    assert.deepEqual((await call('GET', '/quota')).body, { available: 4, consumed: 0 });
    const race = await Promise.all(['One', 'Two'].map((key) => call('POST', '/holds', { units: 3, key })));
    assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
    const allocated = race.find((r) => r.status === 201).body;
    await Promise.all([1, 2].map(() => call('POST', `/holds/${allocated.id}/consume`)));
    assert.deepEqual((await call('GET', '/quota')).body, { available: 1, consumed: 3 });
  });
});
test('an insufficient allocation does not retain its key', async () => {
  await withTarget(null, async (call) => {
    const first = await call('POST', '/holds', { units: 4, key: 'Full' });
    assert.equal((await call('POST', '/holds', { units: 1, key: 'Retry' })).status, 409);
    await call('POST', `/holds/${first.body.id}/release`);
    assert.equal((await call('POST', '/holds', { units: 1, key: 'Retry' })).status, 201);
  });
});

test.each([null, quotaObservationDefect])('rejected consume observation on %s', async (defect) => {
  await withTarget(defect, async (call) => {
    const created = await call('POST', '/holds', { units: 2, key: 'Original' });
    assert.equal(created.status, 201);
    const path = `/holds/${created.body.id}`;
    assert.equal((await call('POST', `${path}/release`)).status, 200);
    const before = await call('GET', path);
    const quota = await call('GET', '/quota');
    assert.equal(before.body.state, 'released');
    assert.equal((await call('POST', `${path}/consume`)).status, 409);
    assert.deepEqual(await call('GET', '/quota'), quota);
    assert.deepEqual(await call('GET', path), {
      ...before,
      body: { ...before.body, key: defect ? 'ChangedAfterReject' : 'Original' },
    });
  });
});
