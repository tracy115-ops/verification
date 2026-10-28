import { createGameTarget } from '../tests/fixtures/blackbox/game-target.mjs';

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex < 0 ? 4320 : Number(args[portIndex + 1]);
if (
  !Number.isInteger(port) ||
  port < 1024 ||
  port > 65535 ||
  args.some(
    (arg, index) => !['--port', '--reference'].includes(arg) && !(portIndex >= 0 && index === portIndex + 1),
  )
) {
  throw new Error('Usage: npm run serve:game-fixture -- [--port 4320] [--reference]');
}
const reference = args.includes('--reference');
const server = createGameTarget(reference);
server.listen(port, '127.0.0.1', () => {
  process.stdout.write(
    `Local game fixture (${reference ? 'reference' : 'deliberately buggy'}): http://127.0.0.1:${port}\nUse only with the provided example framework. State resets before each test.\n`,
  );
});
server.on('error', (error) => {
  process.stderr.write(`${error.code ?? 'fixture_failed'}\n`);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
