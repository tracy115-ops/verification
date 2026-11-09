import { useRef } from 'react';
import { useProtectedDraft } from '../../shared/drafts/context';
import { DraftActions } from '../settings/DraftActions';
import type { AgentProfile } from '../../domain/workflow';
import { validCliLaunch } from '../../domain/cli-launch';
import { useI18n } from '../../shared/i18n/context';
import { hasDesktopBridge } from '../../services/agent-api';
import { useCliInstances } from './useCliInstances';
import { ClaudeSettingsFile } from './ClaudeSettingsFile';

export function NativeLaunchEditor({
  profile,
  save,
  open,
}: {
  profile: AgentProfile;
  save: (profile: AgentProfile) => boolean | void;
  open?: () => void;
}) {
  const { t } = useI18n();
  const details = useRef<HTMLDetailsElement>(null);
  const draft = useProtectedDraft({
    id: `agent-launch:${profile.id}`,
    section: 'agents',
    title: profile.name,
    label: 'cliInstance',
    open: () => {
      open?.();
      requestAnimationFrame(() => {
        if (details.current) {
          details.current.open = true;
          details.current.querySelector('select')?.focus();
        }
      });
    },
    initial: {
      executable: profile.launch?.executablePath ?? '',
      directory: profile.launch?.configDirectory ?? '',
      settingsFile: profile.launch?.settingsFile ?? '',
    },
  });
  const { executable, directory, settingsFile } = draft.value;
  const setExecutable = (executable: string) => draft.change((value) => ({ ...value, executable }));
  const setDirectory = (directory: string) => draft.change((value) => ({ ...value, directory }));
  const setSettingsFile = (settingsFile: string) => draft.change((value) => ({ ...value, settingsFile }));
  const chooser = useCliInstances(profile.driver);
  const desktop = hasDesktopBridge();
  const choices = chooser.instances.map((item) => item.executablePath);
  if (executable && !choices.includes(executable)) choices.unshift(executable);
  const launch = {
    ...(executable.trim() ? { executablePath: executable.trim() } : {}),
    ...(directory.trim() ? { configDirectory: directory.trim() } : {}),
    ...(settingsFile ? { settingsFile } : {}),
  };
  return (
    <details
      ref={details}
      className="settings-native-instance"
      onToggle={(event) => {
        if (event.currentTarget.open && desktop && !chooser.scanned && !chooser.busy && !chooser.error)
          void chooser.scan();
      }}
    >
      <summary>
        {profile.name} · {t('cliInstance')}
      </summary>
      <p className="wb-muted">{t('cliInstanceHint')}</p>
      <form
        className="settings-instance-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.conflicted || !validCliLaunch(launch, profile.driver)) return;
          const next = { ...profile };
          if (Object.keys(launch).length) next.launch = launch;
          else delete next.launch;
          if (save(next) !== false) draft.reset();
        }}
      >
        <div className="settings-instance-choice">
          <label className="wb-field">
            {t('cliChooseInstance')}
            <select
              className="workbench-select"
              value={executable}
              onChange={(event) => setExecutable(event.target.value)}
            >
              <option value="">{t('cliPathAutomatic')}</option>
              {choices.map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
            </select>
          </label>
          <button
            className="workbench-btn"
            type="button"
            disabled={!desktop || chooser.busy}
            onClick={() => void chooser.scan()}
          >
            {t(chooser.busy ? 'detecting' : 'cliScanInstances')}
          </button>
          <button
            className="workbench-btn"
            type="button"
            disabled={!desktop || chooser.busy}
            onClick={() => void chooser.browse('executable', setExecutable)}
          >
            {t('cliBrowseExecutable')}
          </button>
        </div>
        {chooser.scanned && !chooser.instances.length && <p className="wb-muted">{t('cliNoInstances')}</p>}
        {chooser.error && (
          <p className="wb-error" role="alert">
            {t(chooser.error)}
          </p>
        )}
        {!desktop && <p className="wb-muted">{t('browserOnly')}</p>}
        {profile.driver === 'claude' && (
          <div className="wb-field">
            <span>{t('cliConfigDirectory')}</span>
            <div className="settings-instance-choice">
              <span className="wb-muted settings-instance-path">{directory || t('cliConfigInherited')}</span>
              <button
                className="workbench-btn"
                type="button"
                disabled={!desktop || chooser.busy}
                onClick={() => void chooser.browse('configuration', setDirectory)}
              >
                {t('cliBrowseDirectory')}
              </button>
              {directory && (
                <button className="workbench-btn" type="button" onClick={() => setDirectory('')}>
                  {t('cliUseInherited')}
                </button>
              )}
            </div>
            <small className="wb-muted">{t('claudeInstanceAuthHint')}</small>
          </div>
        )}
        {profile.driver === 'claude' && (
          <ClaudeSettingsFile
            path={settingsFile}
            change={setSettingsFile}
            browse={() => void chooser.browse('settings', setSettingsFile)}
            disabled={!desktop || chooser.busy}
          />
        )}
        <details className="settings-instance-advanced">
          <summary>{t('cliAdvancedPaths')}</summary>
          <label className="wb-field">
            {t('cliExecutablePath')}
            <input
              className="workbench-input"
              value={executable}
              maxLength={4096}
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
                onChange={(event) => setDirectory(event.target.value)}
              />
            </label>
          )}
        </details>
        <button
          className="workbench-btn"
          disabled={chooser.busy || draft.conflicted || !validCliLaunch(launch, profile.driver)}
        >
          {t('saveCliInstance')}
        </button>
        <DraftActions dirty={draft.dirty} reset={draft.reset} conflicted={draft.conflicted} />
      </form>
    </details>
  );
}
