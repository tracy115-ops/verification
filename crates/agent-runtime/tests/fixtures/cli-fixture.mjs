import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const mode = process.argv[2];
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (value) => { input += value; });
process.stdin.on('end', () => {
  if (mode === 'oversized') { process.stdout.write('x'.repeat(300000)); return; }
  if (mode === 'wait') { setInterval(() => {}, 1000); return; }
  if (mode === 'partial-json') { process.stdout.write('{"type":"stream_event"'); setInterval(() => {}, 1000); return; }
  if (mode === 'codeagent-error' || mode === 'codeagent-init') {
    console.log(JSON.stringify(mode === 'codeagent-error' ? { type: 'error', error: { message: 'authentication failed: private-token' } } : { type: 'system', subtype: 'init', session_id: 'fixture-session' }));
    setInterval(() => {}, 1000);
    return;
  }
  if (mode === 'tree') {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    writeFileSync(process.argv[3], String(child.pid));
    setInterval(() => {}, 1000);
    return;
  }
  const lines = [
    { type: 'thread.started', thread_id: 'fixture-session' },
    { type: 'item.completed', item: { type: 'agent_message', text: `fixture: ${input}` } },
    { type: 'turn.completed' },
  ].map(value => JSON.stringify(value)).join('\n') + '\n';
  const bytes = Buffer.from(lines);
  process.stdout.write(bytes.subarray(0, 7));
  setTimeout(() => {
    process.stdout.write(bytes.subarray(7));
    if (mode === 'bad-exit') process.exitCode = 1;
  }, 10);
});
