import assert from 'node:assert/strict';
import { createOrderTarget } from '../../tests/fixtures/blackbox/order-target.mjs';

/** Normal paths intentionally avoid replay, rejection and concurrency. */
export async function normalOrderPaths(defect) {
  const target = createOrderTarget(defect);
  await new Promise((resolve, reject) => {
    target.once('error', reject);
    target.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${target.address().port}`;
  const evidence = [];
  async function call(method, route, body) {
    const response = await fetch(base + route, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Player': 'user-a' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
      redirect: 'error',
    });
    const value = await response.json();
    evidence.push({
      request: { method, path: route, body },
      response: { status: response.status, body: value },
    });
    return { status: response.status, body: value };
  }
  try {
    const created = await call('POST', '/orders', { quantity: 1, requestId: 'normal-pay' });
    assert.equal(created.status, 201);
    assert.equal((await call('GET', `/orders/${created.body.id}`)).body.state, 'reserved');
    assert.equal((await call('POST', `/orders/${created.body.id}/pay`, { paymentToken: 'ok' })).status, 200);
    assert.deepEqual((await call('GET', '/wallet')).body, { balance: 90, charges: 1 });
    const reserved = await call('POST', '/orders', { quantity: 1, requestId: 'normal-cancel' });
    assert.equal(reserved.status, 201);
    assert.equal((await call('POST', `/orders/${reserved.body.id}/cancel`, {})).status, 200);
    assert.equal((await call('GET', '/inventory')).body.available, 3);
    return { passed: true, paths: ['reserve-query', 'pay-once', 'cancel-once'], evidence };
  } finally {
    target.closeAllConnections();
    await new Promise((resolve) => target.close(resolve));
  }
}
