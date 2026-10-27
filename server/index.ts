import { mkdirSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { TeamStore } from './store.ts';
import { createTeamServer } from './app.ts';

const { values } = parseArgs({
  options: {
    host: { type: 'string', default: '127.0.0.1' },
    port: { type: 'string', default: '4317' },
    'data-dir': { type: 'string', default: '.verification/team' },
  },
});
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
const staticRoot = path.resolve('dist');
if (!existsSync(path.join(staticRoot, 'index.html')))
  throw new Error('Build the frontend first: npm run build');
const directory = path.resolve(values['data-dir']!);
mkdirSync(directory, { recursive: true });
const store = new TeamStore(path.join(directory, 'team.db'));
const token = store.bootstrap(process.env.TEAM_OWNER_TOKEN);
if (token) process.stdout.write(`Owner access token (shown once): ${token}\n`);
const server = createTeamServer(store, staticRoot);
server.on('error', (error) => {
  process.stderr.write(`${error.message}\n`);
  store.close();
  process.exitCode = 1;
});
server.listen(port, values.host, () => {
  process.stdout.write(`Team workspace: http://127.0.0.1:${port}\n`);
  if (values.host === '0.0.0.0')
    for (const addresses of Object.values(networkInterfaces()))
      for (const address of addresses ?? [])
        if (address.family === 'IPv4' && !address.internal)
          process.stdout.write(`LAN: http://${address.address}:${port}\n`);
});
function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
