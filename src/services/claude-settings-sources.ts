import { invoke } from '@tauri-apps/api/core';
import { validCliLaunch } from '../domain/cli-launch';

export interface ClaudeSettingsCandidate {
  path: string;
  model: string | null;
  authenticationFields: boolean;
  backup: boolean;
}
export async function discoverClaudeSettings(configDirectory?: string): Promise<ClaudeSettingsCandidate[]> {
  const value: unknown = await invoke('discover_claude_settings', {
    configDirectory: configDirectory ?? null,
  });
  if (
    !Array.isArray(value) ||
    value.length > 12 ||
    !value.every(
      (item) =>
        item &&
        validCliLaunch({ settingsFile: item.path }, 'claude') &&
        (item.model === null ||
          (typeof item.model === 'string' &&
            item.model.length <= 200 &&
            !/[\u0000-\u001f\u007f]/.test(item.model))) &&
        typeof item.authenticationFields === 'boolean' &&
        typeof item.backup === 'boolean',
    )
  )
    throw new Error('cliSetupInspectFailed');
  return value;
}
