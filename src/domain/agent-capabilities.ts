import type { AgentProfile } from './workflow';

// Configuration support and installed/authenticated CLI state are separate contracts.
export function supportsInference(profile: AgentProfile): boolean {
  return profile.protocol === 'native';
}
