import { expect, it } from 'vitest';
import { decodeRequirements, decodeDesign, decodeCases, parseArtifact } from './artifacts';
import { requirements, design, cases, spec } from './fixtures.test-support';
import { workflowCommand } from './chat';

it('requires unique exact source quotes and valid scenario/case mappings', () => {
  expect(decodeRequirements(requirements, spec)).toEqual(requirements);
  expect(() => decodeRequirements(requirements, spec + spec)).toThrow('source_quote_ambiguous');
  expect(() => decodeRequirements(requirements, 'unrelated')).toThrow('source_quote_invalid');
  expect(() =>
    decodeDesign(
      { ...design, scenarios: [{ ...design.scenarios[0], requirementIds: ['missing'] }] },
      requirements,
    ),
  ).toThrow('artifact_invalid');
  expect(() =>
    decodeCases({ cases: [{ ...cases.cases[0], scenarioIds: ['missing'] }] }, requirements, design),
  ).toThrow('artifact_invalid');
  expect(() => decodeCases({ cases: [{ ...cases.cases[0], assertions: [] }] }, requirements, design)).toThrow(
    'artifact_invalid',
  );
  expect(parseArtifact('```json\n{"ok":true}\n```')).toEqual({ ok: true });
  expect(() => parseArtifact('not JSON')).toThrow('artifact_invalid');
});
it('recognizes only explicit saved-workflow commands', () => {
  expect(workflowCommand('/running a discussion', 'general-testing').invoke).toBe(false);
  expect(workflowCommand('/run general-testing Spec', 'general-testing')).toEqual({
    invoke: true,
    spec: 'Spec',
  });
  expect(() => workflowCommand('/run another Spec', 'general-testing')).toThrow('workflow_not_found');
});
