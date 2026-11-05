import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)],
  {
    env: { ...process.env, WORKBENCH_TEST_PRODUCTION: '1' },
    stdio: 'inherit',
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
