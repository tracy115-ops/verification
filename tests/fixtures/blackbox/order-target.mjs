import { createServer } from 'node:http';

export const orderDefects = [
  'cancel_replay_stock',
  'declined_payment_commit',
  'payment_replay_debit',
  'idempotency_identity_scope',
  'rejected_cancel_mutation',
  'concurrent_payment_debit',
];

/** Controlled benchmark target. Each variant contains exactly one seeded defect. */
export function createOrderTarget(defect = null) {
  if (defect !== null && !orderDefects.includes(defect)) throw new Error('unknown_order_defect');
  let available, sequence, orders, keys, wallets;
  function reset() {
    available = 4;
    sequence = 0;
    orders = new Map();
    keys = new Map();
    wallets = new Map(['user-a', 'user-b'].map((user) => [user, { balance: 100, charges: 0 }]));
  }
  reset();
  const reply = (response, status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  const charge = (order) => {
    const wallet = wallets.get(order.owner);
    wallet.balance -= order.quantity * 10;
    wallet.charges++;
    order.state = 'paid';
  };
  function reserve(body, user, response) {
    if (
      !Number.isInteger(body.quantity) ||
      body.quantity < 1 ||
      body.quantity > 4 ||
      typeof body.requestId !== 'string' ||
      !body.requestId.trim()
    ) {
      reply(response, 400, { error: 'invalid_input' });
      return;
    }
    const key = defect === 'idempotency_identity_scope' ? body.requestId : `${user}:${body.requestId}`;
    const previous = orders.get(keys.get(key));
    if (previous) {
      reply(
        response,
        previous.quantity === body.quantity ? 200 : 409,
        previous.quantity === body.quantity ? { ...previous } : { error: 'payload_conflict' },
      );
      return;
    }
    if (available < body.quantity) {
      reply(response, 409, { error: 'insufficient_stock' });
      return;
    }
    const order = { id: `order-${++sequence}`, owner: user, quantity: body.quantity, state: 'reserved' };
    orders.set(order.id, order);
    keys.set(key, order.id);
    available -= order.quantity;
    reply(response, 201, { ...order });
  }
  async function pay(order, body, response) {
    if (!['ok', 'declined'].includes(body.paymentToken)) {
      reply(response, 400, { error: 'invalid_token' });
      return;
    }
    if (order.state === 'cancelled') {
      reply(response, 409, { error: 'terminal_state' });
      return;
    }
    if (order.state === 'paid') {
      if (defect === 'payment_replay_debit') charge(order);
      reply(response, 200, { ...order });
      return;
    }
    if (body.paymentToken === 'declined') {
      if (defect === 'declined_payment_commit') charge(order);
      reply(response, 402, { error: 'declined' });
      return;
    }
    if (defect === 'concurrent_payment_debit') await new Promise((resolve) => setTimeout(resolve, 25));
    charge(order);
    reply(response, 200, { ...order });
  }
  function cancel(order, response) {
    if (order.state === 'paid') {
      if (defect === 'rejected_cancel_mutation') {
        available += order.quantity;
        order.state = 'cancelled';
      }
      reply(response, 409, { error: 'paid_order' });
      return;
    }
    if (order.state === 'reserved' || defect === 'cancel_replay_stock') available += order.quantity;
    order.state = 'cancelled';
    reply(response, 200, { ...order });
  }
  return createServer(async (request, response) => {
    try {
      const route = new URL(request.url, 'http://localhost').pathname;
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 65536) {
          reply(response, 413, { error: 'body_limit' });
          return;
        }
        chunks.push(chunk);
      }
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      if (route === '/__fixture/reset' && request.method === 'POST') {
        reset();
        reply(response, 200, { reset: true });
        return;
      }
      const user = request.headers['x-player'];
      if (!wallets.has(user)) {
        reply(response, 401, { error: 'unauthorized' });
        return;
      }
      if (route === '/inventory' && request.method === 'GET') {
        reply(response, 200, { available });
        return;
      }
      if (route === '/wallet' && request.method === 'GET') {
        reply(response, 200, { ...wallets.get(user) });
        return;
      }
      if (route === '/orders' && request.method === 'POST') {
        reserve(body, user, response);
        return;
      }
      const match = /^\/orders\/([^/]+)(?:\/(pay|cancel))?$/.exec(route);
      const order = match && orders.get(match[1]);
      if (!order) {
        reply(response, 404, { error: 'not_found' });
        return;
      }
      if (order.owner !== user) {
        reply(response, 403, { error: 'forbidden' });
        return;
      }
      if (!match[2] && request.method === 'GET') reply(response, 200, { ...order });
      else if (match[2] === 'pay' && request.method === 'POST') await pay(order, body, response);
      else if (match[2] === 'cancel' && request.method === 'POST') cancel(order, response);
      else reply(response, 404, { error: 'not_found' });
    } catch {
      reply(response, 400, { error: 'bad_request' });
    }
  });
}
