import { useI18n } from '../../shared/i18n/context';

export function ClaudeSettingsFile({
  path,
  change,
  browse,
  disabled,
}: {
  path: string;
  change: (path: string) => void;
  browse: () => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="wb-field">
      <span>{t('claudeSettingsFile')}</span>
      <div className="settings-instance-choice">
        <span className="wb-muted settings-instance-path">{path || t('cliConfigInherited')}</span>
        <button className="workbench-btn" type="button" disabled={disabled} onClick={browse}>
          {t('claudeBrowseSettings')}
        </button>
        {path && (
          <button className="workbench-btn" type="button" onClick={() => change('')}>
            {t('cliUseInherited')}
          </button>
        )}
      </div>
      <small className="wb-muted">{t('claudeSettingsFileHint')}</small>
    </div>
  );
}
