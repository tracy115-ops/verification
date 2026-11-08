import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function transientBundleFailure(output) {
  return /failed to bundle project/i.test(output) && /http status:\s*(429|502|503|504)\b/i.test(output);
}

function build() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.ComSpec ?? 'cmd.exe',
      ['/d', '/s', '/c', 'npm.cmd run package:windows -- -- --locked'],
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let tail = '';
    for (const [source, target] of [
      [child.stdout, process.stdout],
      [child.stderr, process.stderr],
    ])
      source.on('data', (chunk) => {
        target.write(chunk);
        tail = (tail + chunk.toString()).slice(-65536);
      });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, output: tail }));
  });
}

export async function packageWithRetry(
  run = build,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await run();
    if (result.code === 0 || attempt === 3 || !transientBundleFailure(result.output)) return result.code;
    process.stdout.write(`Transient bundler download failure; retry ${attempt}/2.\n`);
    await pause(attempt * 10000);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await packageWithRetry();
