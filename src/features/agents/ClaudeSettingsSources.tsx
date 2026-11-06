import { useState } from 'react';
import type { AgentProfile } from '../../domain/workflow';
import { discoverClaudeSettings, type ClaudeSettingsCandidate } from '../../services/claude-settings-sources';
import { pickCliPath } from '../../services/cli-instances';
import { hasDesktopBridge } from '../../services/agent-api';
import { useI18n } from '../../shared/i18n/context';
import type { useAgentConnection } from './useAgentConnection';

export function ClaudeSettingsSources({
  profile,
  save,
  connection,
  blocked,
}: {
  profile: AgentProfile;
  save: (profile: AgentProfile) => void;
  connection: ReturnType<typeof useAgentConnection>;
  blocked: boolean;
}) {
  const { t } = useI18n();
  const [scan, setScan] = useState<{ directory?: string; items: ClaudeSettingsCandidate[] }>();
  const [loading, setLoading] = useState(false);
  const sources = scan?.directory === profile.launch?.configDirectory ? scan?.items : undefined;
  const busy = loading || connection.busy;
  const [error, setError] = useState(false);
  const choose = (path: string, test = false) => {
    const selected = { ...profile, launch: { ...profile.launch, settingsFile: path } };
    save(selected);
    if (test) connection.start(selected);
  };
  async function perform(browse: boolean) {
    setLoading(true);
    setError(false);
    try {
      if (browse) {
        const path = await pickCliPath('settings');
        if (path) choose(path);
      } else
        setScan({
          directory: profile.launch?.configDirectory,
          items: await discoverClaudeSettings(profile.launch?.configDirectory),
        });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="settings-config-sources">
      <p className="wb-muted">{t('claudeChooseSourceHint')}</p>
      <p className="settings-source-current" role="status">
        {t('claudeCurrentSource')}{' '}
        <code>{profile.launch?.settingsFile || t('claudeNoExplicitSettings')}</code>
      </p>
      <small className="wb-muted">{t('claudeScanIsNotValidation')}</small>
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
        <article
          key={source.path}
          className="settings-config-source"
          data-selected={source.path === profile.launch?.settingsFile}
        >
          <code>{source.path}</code>
          {source.path === profile.launch?.settingsFile && (
            <strong>
              {t(
                connection.busy
                  ? 'connectionChecking'
                  : connection.result?.status === 'passed'
                    ? 'claudeSelectedVerified'
                    : connection.result?.status === 'failed'
                      ? 'claudeSelectedFailed'
                      : 'claudeSelectedUntested',
              )}
            </strong>
          )}
          <small>
            {t(source.authenticationFields ? 'claudeSourceAuthFound' : 'claudeSourceAuthAbsent')}
            {source.backup && ` · ${t('claudeSourceBackup')}`}
          </small>
          <div className="settings-config-actions">
            <button
              type="button"
              className="workbench-btn"
              disabled={busy || source.path === profile.launch?.settingsFile}
              onClick={() => choose(source.path)}
            >
              {t(
                source.path === profile.launch?.settingsFile
                  ? 'claudeSourceSelected'
                  : 'claudeUseSettingsSource',
              )}
            </button>
            <button
              className="workbench-btn"
              type="button"
              disabled={busy || blocked || !hasDesktopBridge()}
              onClick={() => choose(source.path, true)}
            >
              {t('claudeSelectAndTest')}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
