import { invoke } from '@tauri-apps/api/core';
import type { AgentProfile } from '../domain/workflow';
export interface ModelHints {
  status: 'found' | 'empty' | 'unavailable' | 'invalid' | 'unsupported';
  candidates: { model: string; source: string }[];
}
export async function readModelHints(profile: AgentProfile): Promise<ModelHints> {
  const value: unknown = await invoke('read_cli_model_hints', {
    driver: profile.driver,
    configDirectory: profile.launch?.configDirectory ?? null,
  });
  if (!value || typeof value !== 'object') throw new Error('cliModelReadFailed');
  const result = value as ModelHints;
  if (
    !['found', 'empty', 'unavailable', 'invalid', 'unsupported'].includes(result.status) ||
    !Array.isArray(result.candidates) ||
    result.candidates.length > 8 ||
    !result.candidates.every(
      (item) =>
        item &&
        typeof item.model === 'string' &&
        item.model.trim().length > 0 &&
        item.model.length <= 200 &&
        !item.model.startsWith('-') &&
        !/[\u0000-\u001f\u007f]/.test(item.model) &&
        typeof item.source === 'string' &&
        item.source.length <= 8192,
    )
  )
    throw new Error('cliModelReadFailed');
  return result;
}
