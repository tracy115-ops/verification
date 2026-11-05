import { useState } from 'react';
import type { AgentProfile } from '../../domain/workflow';
import { validCliLaunch } from '../../domain/cli-launch';
import { useI18n } from '../../shared/i18n/context';

export function NativeLaunchEditor({
  profile,
  save,
}: {
  profile: AgentProfile;
  save: (profile: AgentProfile) => void;
}) {
  const { t } = useI18n();
  const [executable, setExecutable] = useState(profile.launch?.executablePath ?? '');
  const [directory, setDirectory] = useState(profile.launch?.configDirectory ?? '');
  const launch = {
    ...(executable.trim() ? { executablePath: executable.trim() } : {}),
    ...(directory.trim() ? { configDirectory: directory.trim() } : {}),
  };
  return (
    <details className="settings-native-instance">
      <summary>
        {profile.name} · {t('cliInstance')}
      </summary>
      <p className="wb-muted">{t('cliInstanceHint')}</p>
      <form
        className="settings-fields"
        onSubmit={(event) => {
          event.preventDefault();
          if (!validCliLaunch(launch, profile.driver)) return;
          const next = { ...profile };
          if (Object.keys(launch).length) next.launch = launch;
          else delete next.launch;
          save(next);
        }}
      >
        <label className="wb-field">
          {t('cliExecutablePath')}
          <input
            className="workbench-input"
            value={executable}
            maxLength={4096}
            placeholder={t('cliPathAutomatic')}
            onChange={(event) => setExecutable(event.target.value)}
          />
        </label>
        {profile.driver === 'claude' && (
          <label className="wb-field">
            {t('cliConfigDirectory')}
            <input
              className="workbench-input"
              value={directory}
              maxLength={4096}
              placeholder={t('cliConfigInherited')}
              onChange={(event) => setDirectory(event.target.value)}
            />
            <small className="wb-muted">{t('claudeInstanceAuthHint')}</small>
          </label>
        )}
        <button className="workbench-btn" disabled={!validCliLaunch(launch, profile.driver)}>
          {t('saveCliInstance')}
        </button>
      </form>
    </details>
  );
}
