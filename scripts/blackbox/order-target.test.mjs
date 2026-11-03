import { expect, it } from 'vitest';
import { createOrderTarget, orderDefects } from '../../tests/fixtures/blackbox/order-target.mjs';
import { normalOrderPaths } from './order-baseline.mjs';

async function withTarget(defect, check) {
  const target = createOrderTarget(defect);
  await new Promise((resolve, reject) => {
    target.once('error', reject);
    target.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${target.address().port}`;
  const call = async (method, route, body, user = 'user-a') => {
    const response = await fetch(base + route, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Player': user },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    await check(call);
  } finally {
    target.closeAllConnections();
    await new Promise((resolve) => target.close(resolve));
  }
}

it.each([null, ...orderDefects])('normal paths pass for the isolated variant %s', async (defect) => {
  expect((await normalOrderPaths(defect)).passed).toBe(true);
});

it.each([null, 'cancel_replay_stock'])(
  'cancellation replay observes final stock; variant=%s',
  async (defect) => {
    await withTarget(defect, async (call) => {
      const { body: order } = await call('POST', '/orders', { quantity: 2, requestId: 'cancel' });
      expect((await call('POST', `/orders/${order.id}/cancel`, {})).status).toBe(200);
      expect((await call('POST', `/orders/${order.id}/cancel`, {})).status).toBe(200);
      expect((await call('GET', '/inventory')).body.available).toBe(defect ? 6 : 4);
    });
  },
);

it.each([null, 'declined_payment_commit'])(
  'declined payment retains or violates the observable pre-state; variant=%s',
  async (defect) => {
    await withTarget(defect, async (call) => {
      const { body: order } = await call('POST', '/orders', { quantity: 2, requestId: 'decline' });
      expect((await call('POST', `/orders/${order.id}/pay`, { paymentToken: 'declined' })).status).toBe(402);
      expect((await call('GET', `/orders/${order.id}`)).body.state).toBe(defect ? 'paid' : 'reserved');
      expect((await call('GET', '/wallet')).body.balance).toBe(defect ? 80 : 100);
    });
  },
);

it.each([null, 'payment_replay_debit', 'concurrent_payment_debit'])(
  'payment histories check responses and wallet together; variant=%s',
  async (defect) => {
    await withTarget(defect, async (call) => {
      const { body: order } = await call('POST', '/orders', { quantity: 2, requestId: 'pay' });
      const pay = () => call('POST', `/orders/${order.id}/pay`, { paymentToken: 'ok' });
      const results =
        defect === 'concurrent_payment_debit'
          ? await Promise.all([pay(), pay()])
          : [await pay(), await pay()];
      expect(results.map((result) => result.status)).toEqual([200, 200]);
      expect((await call('GET', '/wallet')).body).toEqual({
        balance: defect ? 60 : 80,
        charges: defect ? 2 : 1,
      });
    });
  },
);

it.each([null, 'idempotency_identity_scope'])(
  'idempotency identity scope does not follow a successful one-user replay; variant=%s',
  async (defect) => {
    await withTarget(defect, async (call) => {
      const first = await call('POST', '/orders', { quantity: 1, requestId: 'shared' });
      const replay = await call('POST', '/orders', { quantity: 1, requestId: 'shared' });
      expect(first.status).toBe(201);
      expect(replay.status).toBe(200);
      expect(replay.body.id).toBe(first.body.id);
      expect((await call('POST', '/orders', { quantity: 2, requestId: 'shared' })).status).toBe(409);
      const other = await call('POST', '/orders', { quantity: 1, requestId: 'shared' }, 'user-b');
      expect(other.status).toBe(defect ? 200 : 201);
      expect(other.body.owner).toBe(defect ? 'user-a' : 'user-b');
    });
  },
);

it.each([null, 'rejected_cancel_mutation'])(
  'a correct rejection status does not certify unchanged state; variant=%s',
  async (defect) => {
    await withTarget(defect, async (call) => {
      const { body: order } = await call('POST', '/orders', { quantity: 2, requestId: 'terminal' });
      expect((await call('POST', `/orders/${order.id}/pay`, { paymentToken: 'ok' })).status).toBe(200);
      expect((await call('POST', `/orders/${order.id}/cancel`, {})).status).toBe(409);
      expect((await call('GET', `/orders/${order.id}`)).body.state).toBe(defect ? 'cancelled' : 'paid');
      expect((await call('GET', '/inventory')).body.available).toBe(defect ? 4 : 2);
    });
  },
);
