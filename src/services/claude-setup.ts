import { invoke } from '@tauri-apps/api/core';
export interface ClaudeSetup {
  configDirectory: string;
  settingsFile?: string | null;
  environmentAuth: boolean;
  settingsAuth: boolean;
  loginFilePresent: boolean;
  keyHelperPresent: boolean;
  endpointPresent: boolean;
}
export async function inspectClaudeSetup(
  configDirectory?: string,
  settingsFile?: string,
): Promise<ClaudeSetup> {
  const value: unknown = await invoke('inspect_claude_setup', {
    configDirectory: configDirectory ?? null,
    settingsFile: settingsFile ?? null,
  });
  if (!value || typeof value !== 'object') throw new Error('cliSetupInspectFailed');
  const item = value as ClaudeSetup;
  if (
    typeof item.configDirectory !== 'string' ||
    item.configDirectory.length > 4096 ||
    (item.settingsFile != null &&
      (typeof item.settingsFile !== 'string' || item.settingsFile.length > 4096)) ||
    !['environmentAuth', 'settingsAuth', 'loginFilePresent', 'keyHelperPresent', 'endpointPresent'].every(
      (key) => typeof (item as unknown as Record<string, unknown>)[key] === 'boolean',
    )
  )
    throw new Error('cliSetupInspectFailed');
  return item;
}
