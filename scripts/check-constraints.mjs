import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const roots = ['src', 'server', 'scripts', 'crates', 'src-tauri/src', 'tests'];
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.rs', '.css', '.py']);
const failures = [];
const pythonFiles = [];
let count = 0;

function checkTypeScript(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) {
      const start = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
      const end = source.getLineAndCharacterOfPosition(node.end).line;
      if (end - start + 1 > 200) failures.push(`${file}:${start + 1}: function exceeds 200 lines`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

function checkRust(file, text) {
  const clean = text.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (match) =>
    match.replace(/[^\n]/g, ' '),
  );
  for (const match of clean.matchAll(/\bfn\s+\w+/g)) {
    const opening = clean.indexOf('{', match.index);
    if (opening < 0) continue;
    let depth = 1;
    let end = opening + 1;
    while (end < clean.length && depth > 0) {
      if (clean[end] === '{') depth++;
      if (clean[end] === '}') depth--;
      end++;
    }
    if (clean.slice(match.index, end).split('\n').length > 200)
      failures.push(`${file}: Rust function exceeds 200 lines`);
  }
}

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(file);
      continue;
    }
    const extension = path.extname(file);
    if (!extensions.has(extension)) continue;
    const text = fs.readFileSync(file, 'utf8');
    count++;
    const lines = text ? text.split(/\r?\n/).length - (text.endsWith('\n') ? 1 : 0) : 0;
    if (lines > 2000) failures.push(`${file}: exceeds 2000 lines`);
    if (['.ts', '.tsx', '.js', '.mjs'].includes(extension)) checkTypeScript(file, text);
    if (extension === '.rs') checkRust(file, text);
    if (extension === '.py') pythonFiles.push(file);
    if (
      extension === '.css' &&
      !file.endsWith('workbench-tokens.css') &&
      /#[\da-f]{3,8}\b|rgba?\(/i.test(text)
    )
      failures.push(`${file}: color outside tokens`);
  }
}

roots.forEach(walk);
if (pythonFiles.length) {
  const checker = fileURLToPath(new URL('./check-python-constraints.py', import.meta.url));
  const result = spawnSync('python', [checker, ...pythonFiles], { encoding: 'utf8' });
  if (result.error || result.status !== 0)
    failures.push(result.stderr || result.error?.message || 'Python constraint checker failed');
  else failures.push(...JSON.parse(result.stdout));
}
if (failures.length) {
  failures.forEach((failure) => console.error(failure));
  process.exit(1);
}
console.log(
  `Constraints passed for ${count} source files (TS/Python AST, Rust named-function spans, CSS token colors).`,
);
