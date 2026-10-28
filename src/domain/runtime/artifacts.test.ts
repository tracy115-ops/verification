import { expect, it } from 'vitest';
import { decodeRequirements, decodeDesign, decodeCases, parseArtifact, isGeneratedDesign } from './artifacts';
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
it('validates factor levels and their source against linked requirements', () => {
  const factor = {
    id: 'F-1',
    name: 'Failure count',
    requirementIds: ['REQ-1'],
    levels: ['4', '5'],
    sourceQuote: '失败5次',
  };
  expect(decodeDesign({ ...design, factors: [factor] }, requirements).factors).toHaveLength(1);
  const multiple = {
    ...design,
    factors: [factor],
    scenarios: [
      {
        ...design.scenarios[0],
        factorLevels: [
          { factorId: 'F-1', level: '4' },
          { factorId: 'F-1', level: '5' },
        ],
      },
    ],
  };
  expect(decodeDesign(multiple, requirements).scenarios[0].factorLevels).toHaveLength(2);
  expect(() =>
    decodeDesign(
      {
        ...multiple,
        scenarios: [
          {
            ...multiple.scenarios[0],
            factorLevels: [multiple.scenarios[0].factorLevels[0], multiple.scenarios[0].factorLevels[0]],
          },
        ],
      },
      requirements,
    ),
  ).toThrow('artifact_invalid');
  expect(() =>
    decodeDesign({ ...design, factors: [{ ...factor, sourceQuote: 'invented' }] }, requirements),
  ).toThrow('artifact_invalid');
  expect(() =>
    decodeDesign({ ...design, factors: [{ ...factor, levels: ['5', '5'] }] }, requirements),
  ).toThrow('artifact_invalid');
  expect(() =>
    decodeDesign({ ...design, factors: [{ ...factor, requirementIds: ['REQ-X'] }] }, requirements),
  ).toThrow('artifact_invalid');
  expect(() =>
    decodeDesign(
      {
        ...design,
        factors: [factor],
        scenarios: [{ ...design.scenarios[0], factorLevels: [{ factorId: 'F-1', level: 'invented' }] }],
      },
      requirements,
    ),
  ).toThrow('artifact_invalid');
  expect(isGeneratedDesign(design)).toBe(true);
  const { factors: _factors, ...legacy } = design;
  expect(isGeneratedDesign(legacy)).toBe(false);
});
it('recognizes only explicit saved-workflow commands', () => {
  expect(workflowCommand('/running a discussion', 'general-testing').invoke).toBe(false);
  expect(workflowCommand('/run general-testing Spec', 'general-testing')).toEqual({
    invoke: true,
    spec: 'Spec',
  });
  expect(() => workflowCommand('/run another Spec', 'general-testing')).toThrow('workflow_not_found');
});
