import { expect, it } from 'vitest';
import { createDocument } from '../document';
import { createRun } from './plan';
import { advanceRun } from './engine';
import { fixturePort, spec } from './fixtures.test-support';

it('runs CodeAgent with its internal model despite saved Codex node bindings', async () => {
  const document = createDocument();
  document.revision = 1;
  const original = structuredClone(document.bindings);
  expect(() => createRun(document, crypto.randomUUID(), spec, document.profiles, 'codeagent-native')).toThrow(
    'model_required',
  );
  const run = createRun(
    document,
    crypto.randomUUID(),
    spec,
    document.profiles,
    'codeagent-native',
    undefined,
    'session',
  );
  expect(run.snapshot.bindings).toEqual({});
  expect(document.bindings).toEqual(original);
  const fixture = fixturePort();
  await advanceRun(
    run,
    fixture.port,
    new AbortController().signal,
    () => {},
    () => {},
  );
  expect(fixture.requests.length).toBeGreaterThan(0);
  expect(fixture.requests.every((request) => request.driver === 'codeagent' && request.model === '')).toBe(
    true,
  );
});
