import { createServer } from 'node:http';

// Controlled faulty/reference implementations. The black-box runner never imports this module.
export function createTarget(fixed = false) {
  const balances = { idempotency: 100, concurrent: 100 };
  const keys = new Set(); let sequence = 0;
  function result(response, status, value) { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); }
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      if (url.pathname === '/quote' && request.method === 'POST') {
        const amount = body.amount;
        const validType = fixed ? typeof amount === 'number' : !Number.isNaN(Number(amount));
        const minimum = fixed ? 1 : 0;
        const valid = validType && Number.isInteger(Number(amount)) && Number(amount) >= minimum && Number(amount) <= 100;
        result(response, valid ? 200 : 400, valid ? { amount: Number(amount), fee: Number(amount) * .01 } : { error: 'invalid_amount' });
      } else if (url.pathname.startsWith('/accounts/') && request.method === 'GET') {
        const id = url.pathname.split('/').at(-1);
        if (request.headers.authorization !== 'Bearer user-a') { result(response, 401, { error: 'unauthorized' }); return; }
        if (fixed && id === 'user-b') { result(response, 403, { error: 'forbidden' }); return; }
        result(response, 200, { id, balance: balances[id] ?? 100 });
      } else if (url.pathname === '/transfer' && request.method === 'POST') {
        const key = request.headers['idempotency-key'];
        if (!key || body.amount !== 10) { result(response, 400, { error: 'invalid_request' }); return; }
        if (!fixed || !keys.has(key)) balances.idempotency -= 10;
        keys.add(key); result(response, 200, { accepted: true });
      } else if (url.pathname === '/withdraw' && request.method === 'POST') {
        if (balances.concurrent < body.amount) { result(response, 409, { error: 'insufficient_funds' }); return; }
        // The faulty implementation separates balance validation from debit.
        if (!fixed) await new Promise(resolve => setTimeout(resolve, 25));
        balances.concurrent -= body.amount; result(response, 200, { accepted: true });
      } else if (url.pathname === '/orders/completed/cancel' && request.method === 'POST') {
        result(response, fixed ? 409 : 200, { status: fixed ? 'completed' : 'cancelled' });
      } else if (url.pathname === '/discount' && request.method === 'POST') {
        const eligible = fixed ? body.age >= 18 && body.member === true : body.age >= 18 || body.member === true;
        result(response, 200, { discount: eligible ? 10 : 0 });
      } else if (url.pathname === '/users' && request.method === 'POST') {
        const valid = typeof body.name === 'string' && (fixed ? body.name.trim().length > 0 : body.name.length > 0);
        result(response, valid ? 201 : 400, valid ? { id: ++sequence } : { error: 'invalid_name' });
      } else if (url.pathname === '/payments' && request.method === 'POST') {
        const declined = body.paymentToken === 'declined-fixture';
        result(response, fixed && declined ? 402 : 200, { status: fixed && declined ? 'declined' : 'paid' });
      } else result(response, 404, { error: 'not_found' });
    } catch { result(response, 400, { error: 'bad_request' }); }
  });
}
