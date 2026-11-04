import { describe, expect, it } from 'vitest';
import { advanceRun, approveRun, retryRun } from './engine';
import { fixturePort, fixtureRun, design, requirements } from './fixtures.test-support';
import { decodeDesign } from './artifacts';
import { designMappingIssues } from './design-mapping';
import { taskFor } from './handlers';
import { decodeConversations } from '../../services/conversation-repository';
import { readFileSync } from 'node:fs';

describe('scenario factor mapping diagnostics', () => {
  it('reproduces the actual desktop CLI rejection and accepts its source-backed retry', () => {
    const root = '../../../docs/examples/generated/desktop-orders-2026-11-04/';
    const turns = JSON.parse(readFileSync(new URL(`${root}turns.json`, import.meta.url), 'utf8')) as {
      operation: string;
      validationError?: string;
      text: string;
    }[];
    const baseline = JSON.parse(readFileSync(new URL(`${root}requirements.json`, import.meta.url), 'utf8'));
    const rejected = JSON.parse(turns.find((turn) => turn.validationError)!.text);
    expect(() => decodeDesign(rejected, baseline)).toThrow('design_factor_mapping_invalid');
    expect(designMappingIssues(rejected)).toEqual([
      { scenarioId: 'S01', factorId: 'F03', requirementIds: ['R07'] },
    ]);
    const recovered = JSON.parse(readFileSync(new URL(`${root}design.json`, import.meta.url), 'utf8'));
    expect(decodeDesign(recovered, baseline).scenarios).toHaveLength(2);
    expect(designMappingIssues(recovered)).toEqual([]);
  });

  it('retains exact invalid links across reload and retry without approving invalid artifacts', async () => {
    // Two valid requirements, but the linked factor belongs to the other requirement.
    const second = { ...requirements.requirements[0], id: 'REQ-2' };
    const withTwo = { ...requirements, requirements: [...requirements.requirements, second] };
    const extracted = await advanceRun(
      fixtureRun(),
      fixturePort(withTwo).port,
      new AbortController().signal,
      () => {},
      () => {},
    );
    const gate = extracted.plan.find((node) => extracted.steps[node.id].status === 'awaiting_review')!;
    const ready = await approveRun(extracted, gate.id, extracted.steps[gate.id].reviewDigest!);
    const invalid = structuredClone(design);
    invalid.factors[0].requirementIds = ['REQ-2'];
    expect(() => decodeDesign(invalid, withTwo)).toThrow('design_factor_mapping_invalid');
    const failed = await advanceRun(
      ready,
      fixturePort(invalid).port,
      new AbortController().signal,
      () => {},
      () => {},
    );
    expect(failed.status).toBe('failed');
    const node = failed.plan.find((item) => item.operation === 'scenarios.design')!;
    expect(failed.steps[node.id].designMappingIssues).toEqual([
      { scenarioId: 'SC-1', factorId: 'F-1', requirementIds: ['REQ-2'] },
    ]);
    expect(Object.values(failed.artifacts).some((item) => item.type === 'TestDesignDraft')).toBe(false);
    const session = {
      id: failed.sessionId,
      title: 'mapping recovery',
      profileId: 'codex-native',
      messages: [],
      runs: [failed],
    };
    const reloaded = decodeConversations(JSON.parse(JSON.stringify([session])))[0].runs[0];
    const retried = retryRun(reloaded);
    expect(JSON.parse(taskFor(retried, node, {})).validationFeedback.issues).toEqual([
      { scenarioId: 'SC-1', factorId: 'F-1', requirementIdsPreview: ['REQ-2'], requirementCount: 1 },
    ]);
    const recovered = await advanceRun(
      retried,
      fixturePort(design).port,
      new AbortController().signal,
      () => {},
      () => {},
    );
    expect(recovered.status).toBe('awaiting_review');
    expect(recovered.steps[node.id].designMappingIssues).toBeUndefined();
    expect(recovered.approvals).toEqual(failed.approvals);
  });

  it('does not weaken unknown factor or level validation', () => {
    const invalid = structuredClone(design);
    invalid.scenarios[0].factorLevels[0].level = 'not-a-declared-level';
    expect(() => decodeDesign(invalid, requirements)).toThrow('artifact_invalid');
    expect(designMappingIssues({ arbitrary: 'untrusted' })).toEqual([]);
  });

  it('bounds retry feedback instead of resending every invalid association', () => {
    const run = fixtureRun();
    const node = run.plan.find((item) => item.operation === 'scenarios.design')!;
    run.steps[node.id].designMappingIssues = Array.from({ length: 20 }, (_, i) => ({
      scenarioId: `S${i}`,
      factorId: `F${i}`,
      requirementIds: Array.from({ length: 200 }, (_, j) => `R${j}`),
    }));
    const feedback = JSON.parse(taskFor(run, node, {})).validationFeedback;
    expect(feedback.issues).toHaveLength(5);
    expect(feedback.issues[0].requirementIdsPreview).toHaveLength(8);
    expect(feedback.issues[0].requirementCount).toBe(200);
    expect(JSON.stringify(feedback).length).toBeLessThan(2000);
    const session = {
      id: run.sessionId,
      title: 'feedback',
      profileId: 'codex-native',
      messages: [],
      runs: [run],
    };
    const wrong = run.plan.find((item) => item.operation === 'requirements.extract')!;
    run.steps[wrong.id].designMappingIssues = run.steps[node.id].designMappingIssues;
    expect(() => decodeConversations([session])).toThrow('session_storage_invalid');
  });
});
