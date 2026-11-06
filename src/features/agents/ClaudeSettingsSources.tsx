import { useState } from 'react';
import type { AgentProfile } from '../../domain/workflow';
import { discoverClaudeSettings, type ClaudeSettingsCandidate } from '../../services/claude-settings-sources';
import { pickCliPath } from '../../services/cli-instances';
import { hasDesktopBridge } from '../../services/agent-api';
import { useI18n } from '../../shared/i18n/context';

export function ClaudeSettingsSources({
  profile,
  save,
}: {
  profile: AgentProfile;
  save: (profile: AgentProfile) => void;
}) {
  const { t } = useI18n();
  const [sources, setSources] = useState<ClaudeSettingsCandidate[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const choose = (path: string) => save({ ...profile, launch: { ...profile.launch, settingsFile: path } });
  async function perform(browse: boolean) {
    setBusy(true);
    setError(false);
    try {
      if (browse) {
        const path = await pickCliPath('settings');
        if (path) choose(path);
      } else setSources(await discoverClaudeSettings(profile.launch?.configDirectory));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-config-sources">
      <p className="wb-muted">{t('claudeChooseSourceHint')}</p>
      <div className="settings-config-actions">
        <button
          type="button"
          className="workbench-btn"
          disabled={busy || !hasDesktopBridge()}
          onClick={() => void perform(false)}
        >
          {t('claudeFindSettings')}
        </button>
        <button
          type="button"
          className="workbench-btn"
          disabled={busy || !hasDesktopBridge()}
          onClick={() => void perform(true)}
        >
          {t('claudeBrowseSettings')}
        </button>
      </div>
      {error && (
        <p className="wb-error" role="alert">
          {t('cliSetupInspectFailed')}
        </p>
      )}
      {sources?.length === 0 && <p className="wb-muted">{t('claudeNoSettingsSources')}</p>}
      {sources?.map((source) => (
        <article key={source.path} className="settings-config-source">
          <code>{source.path}</code>
          <small>
            {t(source.authenticationFields ? 'claudeSourceAuthFound' : 'claudeSourceAuthAbsent')}
            {source.backup && ` · ${t('claudeSourceBackup')}`}
          </small>
          <button
            type="button"
            className="workbench-btn"
            disabled={source.path === profile.launch?.settingsFile}
            onClick={() => choose(source.path)}
          >
            {t(
              source.path === profile.launch?.settingsFile
                ? 'claudeSourceSelected'
                : 'claudeUseSettingsSource',
            )}
          </button>
        </article>
      ))}
    </div>
  );
}
