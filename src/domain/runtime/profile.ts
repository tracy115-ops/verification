import type { AgentProfile } from '../workflow';
export function inferenceModel(profile: AgentProfile): string {
  if (profile.protocol !== 'native') throw new Error('unsupported_profile');
  if (profile.driver === 'codeagent') return '';
  if (!profile.model.trim()) throw new Error('model_required');
  return profile.model.trim();
}
