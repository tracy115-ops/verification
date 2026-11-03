import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const mode = process.argv[2];
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (value) => { input += value; });
process.stdin.on('end', () => {
  if (mode === 'stderr-flood') { process.stderr.write('x'.repeat(200000)); return; }
  if (mode === 'claude-private-stream' || mode === 'claude-protocol-flood') {
    console.log(JSON.stringify({ type: 'system', subtype: 'init' }));
    const line = JSON.stringify({ type: 'stream_event', event: { delta: { type: 'thinking_delta', thinking: 'private-thought-'.repeat(8) } } }) + '\n';
    const records = mode === 'claude-protocol-flood' ? 90000 : 14000;
    for (let i = 0; i < records; i++) process.stdout.write(line);
    console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'public answer' }] } }));
    console.log(JSON.stringify({ type: 'result', is_error: false, result: 'public answer' }));
    return;
  }
  if (mode === 'oversized') { process.stdout.write('x'.repeat(300000)); return; }
  if (mode === 'wait') { setInterval(() => {}, 1000); return; }
  if (mode === 'partial-json') { process.stdout.write('{"type":"stream_event"'); setInterval(() => {}, 1000); return; }
  if (mode.startsWith('codeagent-assistant-')) {
    const content = mode.endsWith('thinking') ? [{ type: 'thinking', thinking: 'private-thought' }] : 'public fixture reply';
    console.log(JSON.stringify({ type: 'system', subtype: 'hook_progress' }));
    console.log(JSON.stringify({ type: 'system', subtype: 'init' }));
    console.log(JSON.stringify({ type: 'assistant', message: { content, stop_reason: mode.endsWith('thinking') ? null : 'end_turn' } }));
    setInterval(() => {}, 1000);
    return;
  }
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
