// Generated output is rebuilt from server/ and dist/; never edit .runtime/team-bundle/ manually.
import { rolldown } from 'rolldown';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('.runtime');
const output = path.join(root, 'team-bundle');
if (!output.startsWith(root + path.sep)) throw new Error('Invalid bundle directory');
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
const bundle = await rolldown({ input: 'server/index.ts', platform: 'node', external: /^node:/ });
try {
  await bundle.write({ file: path.join(output, 'server.cjs'), format: 'cjs' });
} finally {
  await bundle.close();
}
cpSync('dist', path.join(output, 'web'), { recursive: true });
