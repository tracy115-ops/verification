import { createServer } from 'node:http';

export function createGameTarget(fixed = false) {
  let members; let score; let submissions; let currentTurn;
  function reset() { members = ['player-a']; score = 0; submissions = new Set(); currentTurn = 3; }
  reset();
  const respond = (response, status, value) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
  return createServer(async (request, response) => {
    try {
      const route = new URL(request.url, 'http://localhost').pathname;
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      const user = request.headers['x-player'];
      if (route === '/__fixture/reset') { reset(); respond(response, 200, { reset: true }); return; }
      if (!user) { respond(response, 401, { error: 'unauthorized' }); return; }
      if (route === '/rooms' && request.method === 'POST') {
        const count = body.maxPlayers;
        const valid = (fixed ? typeof count === 'number' : !Number.isNaN(Number(count))) && Number.isInteger(Number(count)) && Number(count) >= (fixed ? 2 : 1) && Number(count) <= 8 && ['duel', 'squad'].includes(body.mode) && typeof body.ranked === 'boolean' && (!fixed || !body.ranked || body.mode === 'duel' && count === 2);
        respond(response, valid ? 201 : 400, valid ? { id: 'new-room' } : { error: 'invalid_room' });
      } else if (route === '/rooms/private-room') {
        const allowed = !fixed || user === 'player-a';
        respond(response, allowed ? 200 : 403, allowed ? { owner: 'player-a', members: ['player-a'], maxPlayers: 2 } : { error: 'forbidden' });
      } else if (route === '/rooms/race-room/join') {
        if (members.length >= 2) { respond(response, 409, { error: 'full' }); return; }
        if (!fixed) await new Promise(resolve => setTimeout(resolve, 25));
        members.push(user); respond(response, 200, { members: [...members] });
      } else if (route === '/rooms/race-room') {
        respond(response, 200, { members: [...members], maxPlayers: 2 });
      } else if (/^\/matches\/(live|finished)\/actions$/.test(route)) {
        if (!['player-a', 'player-b'].includes(user)) { respond(response, 403, { error: 'forbidden' }); return; }
        if (fixed && (route.includes('finished') || body.turn !== currentTurn)) { respond(response, 409, { error: 'state_conflict' }); return; }
        if (!['attack', 'defend'].includes(body.action)) { respond(response, 400, { error: 'invalid_action' }); return; }
        currentTurn++; respond(response, 200, { currentTurn });
      } else if (route === '/matches/result/result') {
        if (!fixed || !submissions.has(body.submissionId)) score += 10;
        submissions.add(body.submissionId); respond(response, 200, { accepted: true });
      } else if (route === '/players/player-a/score') {
        respond(response, 200, { score });
      } else if (route === '/queue') {
        if (!Number.isInteger(body.level) || body.level < 1 || body.level > 100 || !['cn', 'eu'].includes(body.region)) { respond(response, 400, { error: 'invalid_queue' }); return; }
        const unavailable = fixed && request.headers['x-test-matchmaker'] === 'unavailable';
        respond(response, unavailable ? 503 : 200, { status: unavailable ? 'unavailable' : 'queued' });
      } else respond(response, 404, { error: 'not_found' });
    } catch { respond(response, 400, { error: 'bad_request' }); }
  });
}
