import { createHash, randomUUID } from 'node:crypto';
import { isScriptInput } from '../src/domain/team/collaboration-schema.ts';
import { collaboration, canonical } from '../src/domain/team/collaboration.ts';
import type { TeamMember } from '../src/domain/team/types.ts';
import type { TeamStore } from './store.ts';
import { inspectPython } from './python-inspection.ts';

export async function uploadSharedScript(
  store: TeamStore,
  member: TeamMember,
  projectId: string,
  input: unknown,
) {
  if (!['admin', 'editor'].includes(member.role)) throw new Error('team_forbidden');
  if (
    !input ||
    typeof input !== 'object' ||
    !('revision' in input) ||
    !Number.isInteger(input.revision) ||
    !('script' in input) ||
    !isScriptInput(input.script)
  )
    throw new Error('team_invalid');
  const script = structuredClone(input.script);
  let project = store.get(projectId);
  if (project.revision !== input.revision) throw new Error('team_conflict');
  const methods = await inspectPython(script.source);
  // Parsing is asynchronous. Re-read the baseline before publishing any result.
  project = store.get(projectId);
  if (project.revision !== input.revision) throw new Error('team_conflict');
  project.collaboration ??= collaboration(project);
  const state = project.collaboration;
  if (state.scripts.length >= 30) throw new Error('team_too_large');
  if (new Set(script.mappings.map((item) => item.caseId)).size !== script.mappings.length)
    throw new Error('team_invalid');
  for (const mapping of script.mappings) {
    const item = state.cases.find((item) => item.id === mapping.caseId);
    if (!item || item.revision !== mapping.caseRevision) throw new Error('team_conflict');
    const { revision: _revision, review: _review, declaration: _declaration, ...content } = item;
    if (mapping.definition && canonical(mapping.definition) !== canonical(content))
      throw new Error('team_conflict');
    if (mapping.testNames.some((name) => !methods.includes(name))) throw new Error('collab_method_missing');
  }
  const sha256 = createHash('sha256').update(script.source, 'utf8').digest('hex');
  if (script.execution) {
    if (
      script.execution.scriptSha256 !== sha256 ||
      new Set(script.execution.results.map((item) => item.testName)).size !==
        script.execution.results.length ||
      script.execution.results.some((item) => !methods.includes(item.testName))
    )
      throw new Error('collab_evidence_mismatch');
  }
  state.scripts.push({
    ...script,
    id: `PY_${randomUUID()}`,
    sha256,
    methods,
    by: member.id,
    at: new Date().toISOString(),
  });
  project.revision++;
  project.updatedAt = new Date().toISOString();
  project.updatedBy = member.id;
  return store.save(project, Number(input.revision), 'upload_script', member.id);
}
