import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { app: { type: 'string' }, root: { type: 'string' } } });
if (process.platform !== 'win32' || !values.app || !path.isAbsolute(values.app) || !existsSync(values.app))
  throw new Error('Pass --app with an existing absolute Windows Release executable path.');
const root = path.resolve(values.root ?? `.runtime/desktop-audit-${Date.now()}`);
const profile = path.join(root, 'webview-profile');
mkdirSync(profile, { recursive: true });
const listener = createServer();
await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const env = { ...process.env };
for (const name of Object.keys(env))
  if (name.startsWith('ANTHROPIC_') || name === 'CLAUDE_CODE_OAUTH_TOKEN') delete env[name];
env.WEBVIEW2_USER_DATA_FOLDER = profile;
env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`;
const child = spawn(values.app, [], { env, stdio: 'ignore', detached: true, windowsHide: true });
child.unref();
const instance = {
  pid: child.pid,
  endpoint: `http://127.0.0.1:${port}`,
  profile,
  temporaryAuthRemoved: true,
};
writeFileSync(path.join(root, 'instance.json'), JSON.stringify(instance, null, 2));
let ready = false;
for (let attempt = 0; attempt < 150; attempt++) {
  try {
    if ((await fetch(`${instance.endpoint}/json/version`)).ok) {
      ready = true;
      break;
    }
  } catch {
    /* WebView2 has not exposed its target yet. */
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
}
console.log(JSON.stringify({ ...instance, ready }));
if (!ready) process.exitCode = 1;
