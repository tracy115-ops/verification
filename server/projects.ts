import { randomUUID } from 'node:crypto';
import { isAnalysis, isCommand, isProjectInput } from '../src/domain/team/schema.ts';
import { checkAnalysis, readiness } from '../src/domain/team/rules.ts';
import { suggestAnalysis } from '../src/domain/team/suggestions.ts';
import type { TeamMember, TeamProject } from '../src/domain/team/types.ts';
import type { TeamStore } from './store.ts';
import { applyCollaboration, isCollaborationCommand } from './collaboration.ts';
import { collaboration, invalidateCases } from '../src/domain/team/collaboration.ts';

function requireRole(member: TeamMember, roles: string[]) {
  if (!roles.includes(member.role)) throw new Error('team_forbidden');
}
export function createProject(store: TeamStore, member: TeamMember, value: unknown): TeamProject {
  requireRole(member, ['admin', 'editor']);
  if (!isProjectInput(value)) throw new Error('team_invalid');
  return store.save(
    {
      ...value,
      formatVersion: 1,
      id: `P_${randomUUID()}`,
      revision: 1,
      factors: [],
      scenarios: [],
      questions: [],
      comments: [],
      updatedBy: member.id,
      updatedAt: new Date().toISOString(),
    },
    0,
    'create',
    member.id,
  );
}
export function projectCommand(
  store: TeamStore,
  member: TeamMember,
  id: string,
  value: unknown,
): TeamProject {
  if (
    typeof value !== 'object' ||
    !value ||
    !('revision' in value) ||
    !Number.isInteger(value.revision) ||
    !('command' in value) ||
    !isCommand(value.command)
  )
    throw new Error('team_invalid');
  const command = value.command;
  if (isCollaborationCommand(command)) {
    const project = store.get(id);
    if (project.revision !== value.revision) throw new Error('team_conflict');
    applyCollaboration(store, project, member, command);
    project.revision++;
    project.updatedBy = member.id;
    project.updatedAt = new Date().toISOString();
    return store.save(project, Number(value.revision), command.type, member.id);
  }
  requireRole(
    member,
    command.type === 'review'
      ? ['admin', 'reviewer']
      : command.type === 'comment'
        ? ['admin', 'editor', 'reviewer']
        : ['admin', 'editor'],
  );
  const project = store.get(id);
  if (project.revision !== value.revision) throw new Error('team_conflict');
  if (command.type === 'suggest') {
    if (project.factors.length || project.scenarios.length) throw new Error('team_analysis_exists');
    Object.assign(project, suggestAnalysis(project));
  } else if (command.type === 'replace_analysis') {
    if (collaboration(project).cases.length || collaboration(project).contributions.length)
      throw new Error('collab_replace_blocked');
    if (!isAnalysis(command.analysis)) throw new Error('team_invalid');
    checkAnalysis(command.analysis, project);
    if (
      command.analysis.scenarios.some(
        (item) => item.ownerId && !store.members().some((member) => member.id === item.ownerId),
      )
    )
      throw new Error('team_invalid');
    Object.assign(project, command.analysis);
    project.comments = [];
  } else if (command.type === 'upsert_factor') {
    if (
      project.scenarios.some((scenario) =>
        scenario.factorValues.some(
          (value) => value.factorId === command.factor.id && !command.factor.levels.includes(value.level),
        ),
      )
    )
      throw new Error('team_factor_in_use');
    const index = project.factors.findIndex((item) => item.id === command.factor.id);
    if (index < 0) project.factors.push(command.factor);
    else project.factors[index] = command.factor;
    for (const scenario of project.scenarios)
      if (scenario.factorValues.some((value) => value.factorId === command.factor.id)) delete scenario.review;
    invalidateCases(
      project,
      project.scenarios
        .filter((scenario) => scenario.factorValues.some((value) => value.factorId === command.factor.id))
        .map((scenario) => scenario.id),
    );
  } else if (command.type === 'add_scenario') {
    if (project.scenarios.some((item) => item.id === command.id)) throw new Error('team_invalid');
    project.scenarios.push({
      id: command.id,
      title: command.title,
      interfaceIds: command.interfaceIds,
      factorValues: [],
      oracle: '',
      oracleBasis: 'unknown',
      sourceQuote: '',
      ownerId: '',
    });
  } else {
    const scenario = project.scenarios.find((item) => item.id === command.scenarioId);
    if (!scenario) throw new Error('team_not_found');
    if (command.type === 'edit_scenario') {
      if (command.ownerId && !store.members().some((item) => item.id === command.ownerId))
        throw new Error('team_invalid');
      const { type: _type, scenarioId: _id, ...patch } = command;
      Object.assign(scenario, patch);
      delete scenario.review;
      invalidateCases(project, [scenario.id]);
    } else if (command.type === 'review') {
      if (command.decision === 'accepted' && readiness(scenario, project).length)
        throw new Error('team_review_blocked');
      scenario.review = {
        decision: command.decision,
        comment: command.comment,
        by: member.id,
        at: new Date().toISOString(),
      };
      if (command.decision === 'needs_changes') invalidateCases(project, [scenario.id]);
    } else {
      if (project.comments.length >= 1000) throw new Error('team_too_large');
      project.comments.push({
        id: `C_${randomUUID()}`,
        scenarioId: scenario.id,
        text: command.text,
        by: member.id,
        at: new Date().toISOString(),
      });
    }
  }
  project.revision++;
  project.updatedBy = member.id;
  project.updatedAt = new Date().toISOString();
  return store.save(project, Number(value.revision), command.type, member.id);
}
