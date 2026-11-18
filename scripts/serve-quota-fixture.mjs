import { parseArgs } from 'node:util';
import { createQuotaTarget } from '../tests/fixtures/blackbox/quota-target.mjs';

const { values } = parseArgs({
  options: { port: { type: 'string', default: '4325' }, defect: { type: 'string' } },
});
const port = Number(values.port);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('port_invalid');
const server = createQuotaTarget(values.defect ?? null);
server.listen(port, '127.0.0.1', () =>
  console.log(
    JSON.stringify({
      target: `http://127.0.0.1:${server.address().port}`,
      variant: values.defect ?? 'reference',
    }),
  ),
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
