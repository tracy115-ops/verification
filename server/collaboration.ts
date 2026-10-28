import { randomUUID } from 'node:crypto';
import {
  canonical,
  caseIssues,
  collaboration,
  definition,
  invalidateCases,
} from '../src/domain/team/collaboration.ts';
import type { CaseDefinition, Change, CollaborationCommand } from '../src/domain/team/collaboration.ts';
import type { TeamCommand, TeamMember, TeamProject } from '../src/domain/team/types.ts';
import type { TeamStore } from './store.ts';

export function isCollaborationCommand(command: TeamCommand): command is CollaborationCommand {
  return ['propose', 'resolve_proposal', 'upsert_case', 'review_case', 'declare_coverage'].includes(
    command.type,
  );
}
function putCase(project: TeamProject, value: CaseDefinition) {
  const state = project.collaboration!;
  const previous = state.cases.find((item) => item.id === value.id);
  if (previous) {
    const { revision: _revision, review: _review, declaration: _declaration, ...content } = previous;
    if (canonical(content) === canonical(value)) return;
  }
  if (previous) Object.assign(previous, value, { revision: previous.revision + 1, review: undefined });
  else state.cases.push({ ...value, revision: 1 });
}
function applyChange(project: TeamProject, change: Change) {
  if (change.kind === 'case') {
    putCase(project, change.value);
    return;
  }
  if (change.kind === 'factor') {
    const previous = project.factors.findIndex((item) => item.id === change.value.id);
    const affected = project.scenarios.filter((scenario) =>
      scenario.factorValues.some((value) => value.factorId === change.value.id),
    );
    if (
      affected.some((scenario) =>
        scenario.factorValues.some(
          (value) => value.factorId === change.value.id && !change.value.levels.includes(value.level),
        ),
      )
    )
      throw new Error('team_factor_in_use');
    if (previous < 0) project.factors.push(change.value);
    else project.factors[previous] = change.value;
    for (const scenario of affected) delete scenario.review;
    invalidateCases(
      project,
      affected.map((item) => item.id),
    );
  } else {
    const index = project.scenarios.findIndex((item) => item.id === change.value.id);
    if (index < 0) project.scenarios.push(change.value);
    else project.scenarios[index] = change.value;
    invalidateCases(project, [change.value.id]);
  }
}
export function applyCollaboration(
  store: TeamStore,
  project: TeamProject,
  member: TeamMember,
  command: CollaborationCommand,
) {
  const reviewer = ['admin', 'reviewer'].includes(member.role);
  if (
    member.role === 'viewer' ||
    (['resolve_proposal', 'review_case'].includes(command.type) && !reviewer) ||
    (['upsert_case', 'declare_coverage'].includes(command.type) && !['admin', 'editor'].includes(member.role))
  )
    throw new Error('team_forbidden');
  project.collaboration ??= collaboration(project);
  const state = project.collaboration;
  const at = new Date().toISOString();
  if (command.type === 'propose') {
    const input = command.proposal;
    if (input.baseRevision > project.revision || state.contributions.length >= 100)
      throw new Error('team_invalid');
    const baseline = store.revision(project.id, input.baseRevision);
    const keys = input.items.map((item) => `${item.kind}:${item.value.id}`);
    if (
      new Set(keys).size !== keys.length ||
      new Set(input.items.map((item) => item.id)).size !== input.items.length
    )
      throw new Error('team_invalid');
    const items = input.items.map((item) => {
      const before = definition(baseline, item.kind, item.value.id);
      if ((item.action === 'add') !== (before === null)) throw new Error('collab_proposal_stale');
      return { ...structuredClone(item), before, status: 'pending' as const };
    });
    state.contributions.push({ ...input, id: `PR_${randomUUID()}`, by: member.id, at, items });
  } else if (command.type === 'resolve_proposal') {
    const proposal = state.contributions.find((item) => item.id === command.proposalId);
    const item = proposal?.items.find((item) => item.id === command.itemId);
    if (!item || item.status !== 'pending') throw new Error('collab_proposal_stale');
    if (command.decision === 'rejected' && !command.comment.trim()) throw new Error('team_invalid');
    if (command.decision === 'accepted') {
      if (canonical(definition(project, item.kind, item.value.id)) !== canonical(item.before))
        throw new Error('collab_proposal_stale');
      const applied: Change = command.applied ?? ({ kind: item.kind, value: item.value } as Change);
      if (applied.kind !== item.kind || applied.value.id !== item.value.id) throw new Error('team_invalid');
      if (
        applied.kind !== 'factor' &&
        applied.value.ownerId &&
        !store.members().some((person) => person.id === applied.value.ownerId)
      )
        throw new Error('team_invalid');
      applyChange(project, structuredClone(applied));
      item.resolution = { by: member.id, at, comment: command.comment, applied };
    } else item.resolution = { by: member.id, at, comment: command.comment };
    item.status = command.decision;
  } else if (command.type === 'upsert_case') {
    const current = state.cases.find((item) => item.id === command.value.id);
    if ((current?.revision ?? 0) !== command.caseRevision) throw new Error('team_conflict');
    if (command.value.ownerId && !store.members().some((person) => person.id === command.value.ownerId))
      throw new Error('team_invalid');
    putCase(project, structuredClone(command.value));
  } else {
    const item = state.cases.find((item) => item.id === command.caseId);
    if (!item || item.revision !== command.caseRevision) throw new Error('team_conflict');
    if (command.type === 'review_case') {
      if (command.decision === 'accepted' && caseIssues(project, item).length)
        throw new Error('team_review_blocked');
      item.review = { by: member.id, at, decision: command.decision, comment: command.comment };
    } else if (command.covered) {
      if (!command.note.trim()) throw new Error('collab_reference_required');
      item.declaration = { by: member.id, at, note: command.note, caseRevision: item.revision };
    } else delete item.declaration;
  }
}
