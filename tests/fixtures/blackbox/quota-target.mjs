import { createServer } from 'node:http';

export const quotaDefects = [
  'release_replay',
  'rejected_consume_mutation',
  'tenant_key_scope',
  'reserve_race',
];
export const quotaObservationDefect = 'rejected_consume_record_mutation';

/** Maintainer-only controlled target. Never supply implementation or variant names to the Agent. */
export function createQuotaTarget(defect = null) {
  if (defect !== null && defect !== quotaObservationDefect && !quotaDefects.includes(defect))
    throw new Error('unknown_quota_defect');
  let quotas, holds, keys, sequence;
  function reset() {
    quotas = new Map(['player-a', 'player-b'].map((user) => [user, { available: 4, consumed: 0 }]));
    holds = new Map();
    keys = new Map();
    sequence = 0;
  }
  reset();
  const reply = (response, status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  const fail = (response, status) => reply(response, status, { error: 'rejected' });
  async function reserve(body, user, response) {
    if (
      !Number.isInteger(body.units) ||
      body.units < 1 ||
      body.units > 4 ||
      typeof body.key !== 'string' ||
      !/^[A-Za-z0-9]{1,32}$/.test(body.key)
    ) {
      fail(response, 400);
      return;
    }
    const key = defect === 'tenant_key_scope' ? body.key : `${user}:${body.key}`;
    const previous = holds.get(keys.get(key));
    if (previous) {
      if (previous.units !== body.units) fail(response, 409);
      else reply(response, 200, { ...previous });
      return;
    }
    const quota = quotas.get(user);
    if (quota.available < body.units) {
      fail(response, 409);
      return;
    }
    if (defect === 'reserve_race') await new Promise((resolve) => setTimeout(resolve, 20));
    const hold = { id: `hold-${++sequence}`, owner: user, units: body.units, key: body.key, state: 'active' };
    holds.set(hold.id, hold);
    keys.set(key, hold.id);
    quota.available -= body.units;
    reply(response, 201, { ...hold });
  }
  function transition(hold, action, response) {
    const quota = quotas.get(hold.owner);
    if (action === 'release') {
      if (hold.state === 'consumed') {
        fail(response, 409);
        return;
      }
      if (hold.state === 'active' || defect === 'release_replay') quota.available += hold.units;
      hold.state = 'released';
    } else {
      if (hold.state === 'released') {
        if (defect === 'rejected_consume_mutation') quota.available -= hold.units;
        if (defect === quotaObservationDefect) hold.key = 'ChangedAfterReject';
        fail(response, 409);
        return;
      }
      if (hold.state === 'active') quota.consumed += hold.units;
      hold.state = 'consumed';
    }
    reply(response, 200, { ...hold });
  }
  return createServer(async (request, response) => {
    try {
      const route = new URL(request.url, 'http://localhost').pathname;
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 65536) {
          fail(response, 413);
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
      if (!quotas.has(user)) {
        fail(response, 401);
        return;
      }
      if (route === '/quota' && request.method === 'GET') {
        reply(response, 200, { ...quotas.get(user) });
        return;
      }
      if (route === '/holds' && request.method === 'POST') {
        await reserve(body, user, response);
        return;
      }
      const match = /^\/holds\/([^/]+)(?:\/(release|consume))?$/.exec(route);
      const hold = match && holds.get(match[1]);
      if (!hold) {
        fail(response, 404);
        return;
      }
      if (hold.owner !== user) {
        fail(response, 403);
        return;
      }
      if (!match[2] && request.method === 'GET') reply(response, 200, { ...hold });
      else if (match[2] && request.method === 'POST') transition(hold, match[2], response);
      else fail(response, 404);
    } catch {
      fail(response, 400);
    }
  });
}
