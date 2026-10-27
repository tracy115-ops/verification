import { afterEach, beforeEach, expect, it } from 'vitest';
import path from 'node:path';
import type { Server } from 'node:http';
import { TeamStore } from './store';
import { createTeamServer } from './app';
let store: TeamStore;
let server: Server;
let base: string;
let token: string;
beforeEach(async () => {
  store = new TeamStore(':memory:');
  token = store.bootstrap()!;
  server = createTeamServer(store, path.resolve('tests/fixtures/team-web'));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test address');
  base = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
});
const headers = () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
const input = {
  title: 'Black box',
  mode: 'black_box',
  locale: 'en-US',
  topic: 'External interface only.',
  interfaces: [{ id: 'IF_1', name: 'External API', contract: '' }],
};
it('serves compiled UI while requiring authentication for all project data', async () => {
  expect((await fetch(base + '/')).status).toBe(200);
  expect((await fetch(base + '/.env')).status).toBe(404);
  expect((await fetch(base + '/api/team/projects')).status).toBe(401);
  const response = await fetch(base + '/api/team/members', { headers: headers() });
  expect(response.status).toBe(200);
  expect(JSON.stringify(await response.json())).not.toContain(token);
  expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
});
it('accepts one concurrent write and rejects the other with 409', async () => {
  const created = await fetch(base + '/api/team/projects', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(input),
  });
  const project = (await created.json()) as { id: string };
  const url = `${base}/api/team/projects/${project.id}/commands`;
  const results = await Promise.all(
    [1, 2].map(() =>
      fetch(url, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ revision: 1, command: { type: 'suggest' } }),
      }),
    ),
  );
  expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  const history = await fetch(`${base}/api/team/projects/${project.id}/history`, { headers: headers() });
  expect(await history.json()).toHaveLength(2);
});
it('rejects cross-origin mutations and unknown execution endpoints', async () => {
  expect(
    (
      await fetch(base + '/api/team/projects', {
        method: 'POST',
        headers: { ...headers(), Origin: 'http://another.invalid' },
        body: JSON.stringify(input),
      })
    ).status,
  ).toBe(403);
  expect(
    (await fetch(base + '/api/team/execute', { method: 'POST', headers: headers(), body: '{}' })).status,
  ).toBe(404);
});
