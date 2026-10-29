import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./version.mjs', import.meta.url));
const repository = path.resolve(path.dirname(script), '..');
const files = ['package.json', 'package-lock.json', 'Cargo.toml', 'Cargo.lock', 'src-tauri/tauri.conf.json'];

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verification-version-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src-tauri'));
  for (const file of files) fs.copyFileSync(path.join(repository, file), path.join(root, file));
  return {
    root,
    run: (args = [], ref = 'refs/heads/main') =>
      spawnSync(process.execPath, [script, ...args], {
        cwd: root,
        env: { ...process.env, GITHUB_REF: ref },
        encoding: 'utf8',
      }),
  };
}

test('synchronizes all application versions and accepts a matching release tag', (t) => {
  const { run } = fixture(t);
  assert.equal(run(['0.1.1']).status, 0);
  assert.equal(run([], 'refs/tags/v0.1.1').status, 0);
});

test('supports numbered prereleases', (t) => {
  const { run } = fixture(t);
  assert.equal(run(['0.2.0-rc.1']).status, 0);
  assert.equal(run([], 'refs/tags/v0.2.0-rc.1').status, 0);
});

test('rejects mismatched tags', (t) => {
  const { run } = fixture(t);
  assert.notEqual(run([], 'refs/tags/v99.0.0').status, 0);
});

test('rejects mismatched application and lock versions', (t) => {
  const { root, run } = fixture(t);
  const file = path.join(root, 'src-tauri/tauri.conf.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  config.version = '99.0.0';
  fs.writeFileSync(file, JSON.stringify(config));
  assert.notEqual(run().status, 0);
});

test('invalid version input leaves manifests untouched', (t) => {
  const { root, run } = fixture(t);
  const before = files.map((file) => fs.readFileSync(path.join(root, file), 'utf8'));
  for (const version of ['v1.0.0', '01.0.0', '1.0.0-alpha.01', 'latest']) {
    assert.notEqual(run([version]).status, 0);
  }
  assert.deepEqual(
    files.map((file) => fs.readFileSync(path.join(root, file), 'utf8')),
    before,
  );
});
