import type { AgentProfile } from '../workflow';
import { validCliLaunch } from '../cli-launch';
import { supportsInference } from '../agent-capabilities';
export function nativeAgentFields(profile: AgentProfile) {
  if (!validCliLaunch(profile.launch, profile.driver)) throw new Error('invalidProfile');
  return {
    driver: profile.driver,
    model: inferenceModel(profile),
    ...(profile.launch ? { launch: structuredClone(profile.launch) } : {}),
  };
}
export function inferenceModel(profile: AgentProfile): string {
  if (!supportsInference(profile)) throw new Error('unsupported_profile');
  if (profile.driver === 'codeagent') return '';
  if (!profile.model.trim()) throw new Error('model_required');
  return profile.model.trim();
}
