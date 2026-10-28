import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces, hostname } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { TeamStore } from './store.ts';
import { createTeamServer } from './app.ts';
import { advertiseTeam } from './discovery.ts';

const { values } = parseArgs({
  options: {
    host: { type: 'string', default: '127.0.0.1' },
    port: { type: 'string', default: '4317' },
    'data-dir': { type: 'string', default: '.verification/team' },
    'static-root': { type: 'string', default: 'dist' },
    managed: { type: 'boolean', default: false },
    discoverable: { type: 'boolean', default: false },
    name: { type: 'string', default: hostname() },
  },
});
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
const staticRoot = path.resolve(values['static-root']!);
if (!existsSync(path.join(staticRoot, 'index.html')))
  throw new Error('Build the frontend first: npm run build');
const directory = path.resolve(values['data-dir']!);
mkdirSync(directory, { recursive: true });
const store = new TeamStore(path.join(directory, 'team.db'));
const token = store.bootstrap(process.env.TEAM_OWNER_TOKEN);
const tokenFile = path.join(directory, 'owner-token');
let ownerToken: string | null = token;
if (values.managed) {
  if (token) writeFileSync(tokenFile, token, { mode: 0o600 });
  else if (existsSync(tokenFile)) ownerToken = readFileSync(tokenFile, 'utf8').trim();
  if (ownerToken && store.authenticate(ownerToken)?.role !== 'admin') ownerToken = null;
} else if (token) process.stdout.write(`Owner access token (shown once): ${token}\n`);
const server = createTeamServer(store, staticRoot);
let discovery: ReturnType<typeof advertiseTeam> | undefined;
server.on('error', (error) => {
  process.stderr.write(`${error.message}\n`);
  store.close();
  process.exitCode = 1;
});
server.listen(port, values.host, async () => {
  const addresses = [`http://127.0.0.1:${port}`];
  if (values.host === '0.0.0.0')
    for (const interfaces of Object.values(networkInterfaces()))
      for (const address of interfaces ?? [])
        if (address.family === 'IPv4' && !address.internal)
          addresses.push(`http://${address.address}:${port}`);
  if (values.discoverable && values.host === '0.0.0.0') {
    discovery = advertiseTeam(port, values.name!.trim().slice(0, 80) || hostname());
    await discovery.ready;
  }
  if (values.managed)
    process.stdout.write(
      `${JSON.stringify({ version: 1, port, addresses, ownerToken, discoverable: discovery?.available ?? false })}\n`,
    );
  else for (const address of addresses) process.stdout.write(`Team workspace: ${address}\n`);
});
function shutdown() {
  discovery?.close();
  server.close(() => {
    store.close();
    process.exit(0);
  });
  server.closeAllConnections();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
