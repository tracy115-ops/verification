import type { AgentProfile } from '../../domain/workflow';
import { useI18n } from '../../shared/i18n/context';

export function NativeConfigSummary({ profile }: { profile: AgentProfile }) {
  const { t } = useI18n();
  return (
    <dl className="settings-config-summary">
      <dt>{t('cliExecutablePath')}</dt>
      <dd>
        <code>{profile.launch?.executablePath || t('cliPathAutomatic')}</code>
      </dd>
      {profile.driver === 'claude' && (
        <>
          <dt>{t('cliConfigDirectory')}</dt>
          <dd>
            <code>{profile.launch?.configDirectory || t('cliConfigInherited')}</code>
          </dd>
          <dt>{t('claudeSettingsFile')}</dt>
          <dd>
            <code>{profile.launch?.settingsFile || t('claudeNoExplicitSettings')}</code>
          </dd>
        </>
      )}
      <dt>{t('model')}</dt>
      <dd>
        <code>
          {profile.driver === 'codeagent'
            ? t('codeagentManagedModel')
            : profile.model || t('modelRequiredHint')}
        </code>
      </dd>
    </dl>
  );
}
