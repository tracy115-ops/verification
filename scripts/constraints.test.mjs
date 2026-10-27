import { afterEach, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('./check-constraints.mjs', import.meta.url));
const roots = [];

it('checks Python function spans using the Python AST', () => {
  const allowed = `def example():\n${'    # comment\n'.repeat(198)}    return 1\n`;
  expect(runCheck(allowed, 'example.py')()).toBeDefined();
  expect(runCheck(allowed.replace('    return 1', '    # extra\n    return 1'), 'example.py')).toThrow();
});

function runCheck(text, filename = 'example.ts') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'verification-constraints-'));
  roots.push(directory);
  fs.mkdirSync(path.join(directory, 'src'));
  fs.writeFileSync(path.join(directory, 'src', filename), text);
  return () => execFileSync(process.execPath, [checker], { cwd: directory, stdio: 'pipe' });
}

afterEach(() => {
  for (const directory of roots.splice(0)) {
    const resolved = fs.realpathSync(directory);
    expect(path.dirname(resolved)).toBe(fs.realpathSync(os.tmpdir()));
    expect(path.basename(resolved)).toMatch(/^verification-constraints-/);
    fs.rmSync(resolved, { recursive: true });
  }
});

it('allows 2000 physical lines, including a final newline, and rejects 2001', () => {
  expect(runCheck('export {};\n' + '\n'.repeat(1999))).not.toThrow();
  expect(runCheck('export {};\n' + '\n'.repeat(2000))).toThrow();
});

it('allows a 200-line function and rejects a 201-line function using the AST', () => {
  const source = (lines) => 'export function sample() {\n' + '\n'.repeat(lines - 2) + '}\n';
  expect(runCheck(source(200))).not.toThrow();
  expect(runCheck(source(201))).toThrow();
});

it('rejects literal colors in feature CSS and allows theme tokens', () => {
  expect(runCheck('.feature { color: #fff; }', 'feature.css')).toThrow();
  expect(runCheck('.feature { color: var(--wb-text); }', 'feature.css')).not.toThrow();
});
