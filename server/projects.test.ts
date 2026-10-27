import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rmSync } from 'node:fs';
import { TeamStore } from './store';
import { createProject, projectCommand } from './projects';
import { factorCoverage } from '../src/domain/team/rules';
import type { TeamMember, TeamProject } from '../src/domain/team/types';

let store: TeamStore;
let admin: TeamMember;
let project: TeamProject;
beforeEach(() => {
  store = new TeamStore(':memory:');
  const token = store.bootstrap()!;
  admin = store.authenticate(token)!;
  project = createProject(store, admin, {
    title: '黑盒题',
    mode: 'black_box',
    locale: 'zh-CN',
    topic: '登录失败5次后锁定。',
    interfaces: [{ id: 'IF_1', name: '登录', contract: '失败5次后锁定。' }],
  });
  project = projectCommand(store, admin, project.id, { revision: 1, command: { type: 'suggest' } });
});
afterEach(() => store.close());
const command = (member: TeamMember, value: unknown, revision = project.revision) =>
  projectCommand(store, member, project.id, { revision, command: value });
function fillScenario() {
  const scenario = project.scenarios[0];
  project = command(admin, {
    type: 'edit_scenario',
    scenarioId: scenario.id,
    title: scenario.title,
    oracle: '锁定',
    oracleBasis: 'contract',
    sourceQuote: '失败5次后锁定。',
    factorValues: scenario.factorValues,
    ownerId: admin.id,
  });
}
it('enforces permissions and does not trust client-provided identity or approvals', () => {
  const viewer = store.addMember('Viewer', 'viewer');
  const editor = store.addMember('Editor', 'editor');
  const reviewer = store.addMember('Reviewer', 'reviewer');
  expect(() => command(viewer, { type: 'suggest' })).toThrow('team_forbidden');
  expect(() =>
    command(editor, {
      type: 'review',
      scenarioId: project.scenarios[0].id,
      decision: 'accepted',
      comment: '',
    }),
  ).toThrow('team_forbidden');
  expect(() => command(reviewer, { type: 'suggest' })).toThrow('team_forbidden');
  const scenario = {
    ...project.scenarios[0],
    review: { decision: 'accepted', by: admin.id, at: new Date().toISOString(), comment: '' },
  };
  expect(() =>
    command(admin, {
      type: 'replace_analysis',
      analysis: { factors: project.factors, scenarios: [scenario], questions: [] },
    }),
  ).toThrow('team_invalid');
  expect(store.members().some((member) => 'token' in member)).toBe(false);
});
it('blocks gaps, records reviewer identity and invalidates acceptance after editing', () => {
  const reviewer = store.addMember('Reviewer', 'reviewer');
  const review = {
    type: 'review',
    scenarioId: project.scenarios[0].id,
    decision: 'accepted',
    comment: '确认设计',
  };
  expect(() => command(reviewer, review)).toThrow('team_review_blocked');
  fillScenario();
  project = command(reviewer, review);
  expect(project.scenarios[0].review?.by).toBe(reviewer.id);
  expect(factorCoverage(project, project.factors[0].id).covered).toBe(1);
  fillScenario();
  expect(project.scenarios[0].review).toBeUndefined();
  expect(factorCoverage(project, project.factors[0].id).covered).toBe(0);
});
it('rejects stale writes without changing the project or audit history', () => {
  const revision = project.revision;
  fillScenario();
  expect(() =>
    command(admin, { type: 'comment', scenarioId: project.scenarios[0].id, text: 'stale' }, revision),
  ).toThrow('team_conflict');
  expect(store.get(project.id).revision).toBe(revision + 1);
  expect(store.history(project.id)).toHaveLength(revision + 1);
  expect(store.revision(project.id, 1).factors).toHaveLength(0);
});
it('invalidates dependent reviews on factor changes and refuses removal of referenced levels', () => {
  fillScenario();
  project = command(admin, {
    type: 'review',
    scenarioId: project.scenarios[0].id,
    decision: 'accepted',
    comment: '',
  });
  const factor = { ...project.factors[0], rationale: '团队补充的边界说明' };
  project = command(admin, { type: 'upsert_factor', factor });
  expect(project.scenarios[0].review).toBeUndefined();
  expect(() =>
    command(admin, { type: 'upsert_factor', factor: { ...factor, levels: ['另一个水平'] } }),
  ).toThrow('team_factor_in_use');
  expect(store.get(project.id).revision).toBe(project.revision);
});
it('adds manual scenarios with unresolved gaps until factors and expectations are supplied', () => {
  project = command(admin, {
    type: 'add_scenario',
    id: 'SC_manual',
    title: '团队补充异常场景',
    interfaceIds: ['IF_1'],
  });
  expect(project.scenarios.at(-1)?.factorValues).toEqual([]);
  expect(project.scenarios.at(-1)?.review).toBeUndefined();
  expect(() =>
    command(admin, { type: 'add_scenario', id: 'SC_invalid', title: '无效接口', interfaceIds: ['missing'] }),
  ).toThrow('team_invalid');
});
it('persists complete revisions and identities across database reopen', () => {
  const file = path.join(tmpdir(), `verification-team-${randomUUID()}.db`);
  let database = new TeamStore(file);
  try {
    const token = database.bootstrap()!;
    const owner = database.authenticate(token)!;
    const saved = createProject(database, owner, {
      title: '持久化',
      mode: 'collaborative',
      locale: 'en-US',
      topic: 'Only a topic',
      interfaces: [],
    });
    database.close();
    database = new TeamStore(file);
    expect(database.bootstrap()).toBeNull();
    expect(database.authenticate(token)?.id).toBe(owner.id);
    expect(database.get(saved.id).topic).toBe('Only a topic');
    expect(database.history(saved.id)).toHaveLength(1);
  } finally {
    database.close();
    for (const suffix of ['', '-wal', '-shm']) rmSync(file + suffix, { force: true });
  }
});
