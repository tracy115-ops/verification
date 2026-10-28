import { afterEach, beforeEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { TeamStore } from './store';
import { createProject, projectCommand } from './projects';
import { uploadSharedScript } from './shared-scripts';
import { inspectPython } from './python-inspection';
import { collaboration, scriptCoverage, type CaseDefinition } from '../src/domain/team/collaboration';
import type { TeamCommand, TeamMember, TeamProject } from '../src/domain/team/types';
let store: TeamStore;
let member: TeamMember;
let project: TeamProject;
const source =
  'import unittest\nclass Cases(unittest.TestCase):\n    def test_capacity(self):\n        self.assertEqual(2, 2)\n';
const caseValue: CaseDefinition = {
  id: 'TC_1',
  title: 'Capacity',
  scenarioIds: ['S1'],
  preconditions: [],
  steps: ['Create room'],
  expected: '201',
  assertions: ['status == 201'],
  ownerId: '',
};
function command(value: TeamCommand, who = member) {
  project = projectCommand(store, who, project.id, { revision: project.revision, command: value });
  return project;
}
beforeEach(() => {
  store = new TeamStore(':memory:');
  const token = store.bootstrap()!;
  member = store.authenticate(token)!;
  project = createProject(store, member, {
    title: 'Team',
    mode: 'black_box',
    locale: 'en-US',
    topic: 'Capacity 2 returns 201.',
    interfaces: [{ id: 'IF1', name: 'Rooms', contract: 'Capacity 2 returns 201.' }],
  });
  command({
    type: 'upsert_factor',
    factor: {
      id: 'F1',
      name: 'Capacity',
      levels: ['2'],
      basis: 'explicit',
      sourceQuote: 'Capacity 2',
      rationale: 'Boundary',
    },
  });
  command({ type: 'add_scenario', id: 'S1', title: 'Create', interfaceIds: ['IF1'] });
  command({
    type: 'edit_scenario',
    scenarioId: 'S1',
    title: 'Create',
    oracle: '201',
    oracleBasis: 'contract',
    sourceQuote: 'Capacity 2 returns 201.',
    factorValues: [{ factorId: 'F1', level: '2' }],
    ownerId: member.id,
  });
  command({ type: 'review', scenarioId: 'S1', decision: 'accepted', comment: 'Reviewed' });
  command({ type: 'upsert_case', caseRevision: 0, value: { ...caseValue, ownerId: member.id } });
});
afterEach(() => store.close());
it('merges individual suggestions without replacing other work, and rejects stale baselines', () => {
  const baseline = project.revision;
  command({ type: 'comment', scenarioId: 'S1', text: 'Keep this discussion' });
  command({
    type: 'propose',
    proposal: {
      version: 1,
      baseRevision: baseline,
      source: { kind: 'agent', name: 'Other Agent', runId: 'run-1' },
      items: [
        {
          id: 'I1',
          kind: 'case',
          action: 'update',
          reason: 'Additional assertion',
          value: { ...caseValue, ownerId: member.id, assertions: ['status == 201', 'response is JSON'] },
        },
      ],
    },
  });
  const proposal = collaboration(project).contributions[0];
  command({
    type: 'resolve_proposal',
    proposalId: proposal.id,
    itemId: 'I1',
    decision: 'accepted',
    comment: 'Accepted',
  });
  expect(collaboration(project).cases[0].assertions).toHaveLength(2);
  expect(project.comments[0].text).toBe('Keep this discussion');
  command({
    type: 'propose',
    proposal: {
      version: 1,
      baseRevision: baseline,
      source: { kind: 'human', name: 'Colleague', runId: '' },
      items: [
        {
          id: 'I2',
          kind: 'case',
          action: 'update',
          reason: 'Old view',
          value: { ...caseValue, ownerId: member.id },
        },
      ],
    },
  });
  const stale = collaboration(project).contributions[1];
  expect(() =>
    command({
      type: 'resolve_proposal',
      proposalId: stale.id,
      itemId: 'I2',
      decision: 'accepted',
      comment: '',
    }),
  ).toThrow('collab_proposal_stale');
  expect(() =>
    command({ type: 'replace_analysis', analysis: { factors: [], scenarios: [], questions: [] } }),
  ).toThrow('collab_replace_blocked');
});
it('separates declarations, AST mappings and results; related design changes invalidate them', async () => {
  command({ type: 'review_case', caseId: 'TC_1', caseRevision: 1, decision: 'accepted', comment: 'Good' });
  expect(() =>
    command({ type: 'declare_coverage', caseId: 'TC_1', caseRevision: 1, covered: true, note: '' }),
  ).toThrow('collab_reference_required');
  command({
    type: 'declare_coverage',
    caseId: 'TC_1',
    caseRevision: 1,
    covered: true,
    note: 'test_cases.py::test_capacity',
  });
  expect(scriptCoverage(project, collaboration(project).cases[0])).toMatchObject({
    status: 'declared',
    execution: 'not_run',
  });
  project = await uploadSharedScript(store, member, project.id, {
    revision: project.revision,
    script: {
      version: 1,
      name: 'test_cases.py',
      source,
      mappings: [{ caseId: 'TC_1', caseRevision: 1, testNames: ['test_capacity'] }],
    },
  });
  expect(scriptCoverage(project, collaboration(project).cases[0])).toMatchObject({
    status: 'mapped',
    execution: 'not_run',
  });
  command({ type: 'upsert_case', caseRevision: 1, value: { ...caseValue, ownerId: member.id } });
  expect(collaboration(project).cases[0].revision).toBe(1);
  expect(scriptCoverage(project, collaboration(project).cases[0]).status).toBe('mapped');
  command({ type: 'upsert_factor', factor: { ...project.factors[0], rationale: 'Changed design' } });
  expect(collaboration(project).cases[0].review).toBeUndefined();
  expect(scriptCoverage(project, collaboration(project).cases[0])).toMatchObject({
    status: 'stale',
    execution: 'not_run',
  });
});
it('binds imported results to the exact script and never carries them into a new file version', async () => {
  const script = {
    version: 1,
    name: 'test_cases.py',
    source,
    mappings: [{ caseId: 'TC_1', caseRevision: 1, testNames: ['test_capacity'] }],
    execution: {
      runId: 'run',
      executionId: 'execution',
      scriptSha256: createHash('sha256').update(source).digest('hex'),
      evidenceDigest: 'a'.repeat(64),
      results: [{ testName: 'test_capacity', status: 'passed' }],
    },
  };
  project = await uploadSharedScript(store, member, project.id, { revision: project.revision, script });
  expect(scriptCoverage(project, collaboration(project).cases[0]).execution).toBe('passed');
  await expect(
    uploadSharedScript(store, member, project.id, {
      revision: project.revision,
      script: { ...script, source: source + '\n# Changed' },
    }),
  ).rejects.toThrow('collab_evidence_mismatch');
  const { execution: _, ...next } = script;
  project = await uploadSharedScript(store, member, project.id, {
    revision: project.revision,
    script: { ...next, source: source + '\n# New version' },
  });
  expect(scriptCoverage(project, collaboration(project).cases[0]).execution).toBe('not_run');
});
it('rejects missing methods, empty tests and unauthorized writes without executing Python source', async () => {
  await expect(
    uploadSharedScript(store, member, project.id, {
      revision: project.revision,
      script: {
        version: 1,
        name: 'test_cases.py',
        source,
        mappings: [{ caseId: 'TC_1', caseRevision: 1, testNames: ['test_missing'] }],
      },
    }),
  ).rejects.toThrow('collab_method_missing');
  await expect(inspectPython('class T:\n    def test_empty(self):\n        pass\n')).rejects.toThrow(
    'collab_script_invalid',
  );
  expect(await inspectPython('raise RuntimeError("MUST NOT EXECUTE")\n' + source)).toEqual(['test_capacity']);
  expect(() =>
    command(
      { type: 'declare_coverage', caseId: 'TC_1', caseRevision: 1, covered: true, note: 'test' },
      { ...member, role: 'viewer' },
    ),
  ).toThrow('team_forbidden');
});
