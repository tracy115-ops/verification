import { collaboration } from './collaboration.ts';
import type { TeamProject } from './types.ts';

export function checkCollaboration(project: TeamProject) {
  const state = collaboration(project);
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (
    !unique(state.cases.map((item) => item.id)) ||
    !unique(state.contributions.map((item) => item.id)) ||
    !unique(state.scripts.map((item) => item.id))
  )
    throw new Error('team_invalid');
  for (const item of state.cases)
    if (item.scenarioIds.some((id) => !project.scenarios.some((scenario) => scenario.id === id)))
      throw new Error('team_invalid');
  for (const proposal of state.contributions)
    if (!unique(proposal.items.map((item) => item.id))) throw new Error('team_invalid');
  for (const script of state.scripts) {
    if (!unique(script.methods) || !unique(script.mappings.map((mapping) => mapping.caseId)))
      throw new Error('team_invalid');
    for (const mapping of script.mappings)
      if (
        !state.cases.some((item) => item.id === mapping.caseId) ||
        mapping.testNames.some((name) => !script.methods.includes(name))
      )
        throw new Error('team_invalid');
  }
}
