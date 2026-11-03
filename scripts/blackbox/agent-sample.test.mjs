import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadSample, scriptDigest } from './agent-sample.mjs';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    const resolved = path.resolve(root);
    if (
      path.dirname(resolved) !== path.resolve(tmpdir()) ||
      !path.basename(resolved).startsWith('deep-sample-test-')
    )
      throw new Error('unexpected_test_directory');
    rmSync(resolved, { recursive: true, force: true });
  }
});
function sample() {
  const root = mkdtempSync(path.join(tmpdir(), 'deep-sample-test-'));
  roots.push(root);
  const artifact = {
    script:
      'import unittest\nimport framework\nclass Example(framework.BlackBoxCase):\n    def test_example(self):\n        self.assertEqual(1, 1)\n',
    coverage: [{ requirementIds: ['R1'], method: 'boundary', testNames: ['test_example'] }],
    questions: [],
  };
  const prompt = JSON.stringify({ topic: 'declared fixture contract' });
  const generation = {
    scriptSha256: scriptDigest(artifact.script),
    artifactSha256: scriptDigest(JSON.stringify(artifact)),
    promptSha256: scriptDigest(prompt),
  };
  writeFileSync(path.join(root, 'agent-artifact.json'), JSON.stringify(artifact));
  writeFileSync(path.join(root, 'generation.json'), JSON.stringify(generation));
  writeFileSync(path.join(root, 'prompt.json'), prompt);
  return { root, artifact };
}
it('accepts the exact archived script, mapping and request without calling a model', () => {
  const { root, artifact } = sample();
  expect(loadSample(root)).toEqual(artifact);
});
it.each(['script', 'mapping', 'request', 'unknown_requirement'])(
  'rejects modified benchmark evidence: %s',
  (change) => {
    const { root, artifact } = sample();
    if (change === 'request') writeFileSync(path.join(root, 'prompt.json'), '{}');
    else {
      if (change === 'script') artifact.script += '\n# modified';
      if (change === 'mapping') artifact.coverage[0].requirementIds = ['R2'];
      if (change === 'unknown_requirement') artifact.coverage[0].requirementIds = ['R99'];
      writeFileSync(path.join(root, 'agent-artifact.json'), JSON.stringify(artifact));
    }
    expect(() => loadSample(root)).toThrow();
  },
);
