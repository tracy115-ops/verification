import { spawn } from 'node:child_process';

export function runProcess(program, args, input, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    let exceeded = false;
    const timer = setTimeout(() => {
      exceeded = true;
      child.kill();
    }, options.timeout ?? 60000);
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.length > 4_000_000) {
        exceeded = true;
        child.kill();
      }
    });
    child.stderr.on('data', (data) => {
      if (stderr.length < 131072) stderr += data.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (exceeded) reject(new Error('process_limit'));
      else if (code !== 0) reject(new Error(`process_exit_${code}: ${stderr.slice(-1000)}`));
      else resolve({ stdout, stderr });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
  });
}
