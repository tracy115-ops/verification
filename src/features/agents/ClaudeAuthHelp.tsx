import { useEffect, useState } from 'react';
import type { AgentProfile } from '../../domain/workflow';
import { inspectClaudeSetup, type ClaudeSetup } from '../../services/claude-setup';
import { useI18n } from '../../shared/i18n/context';

export function ClaudeAuthHelp({ profile }: { profile: AgentProfile }) {
  const { t } = useI18n();
  const [setup, setSetup] = useState<ClaudeSetup>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void inspectClaudeSetup(profile.launch?.configDirectory)
      .then((value) => {
        if (active) setSetup(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [profile.launch?.configDirectory]);
  if (failed) return <p className="wb-muted">{t('cliSetupInspectFailed')}</p>;
  if (!setup) return <p className="wb-muted">{t('claudeInspectingAuth')}</p>;
  const found =
    setup.environmentAuth || setup.settingsAuth || setup.loginFilePresent || setup.keyHelperPresent;
  return (
    <div className="settings-auth-help">
      <strong>{t('claudeAuthSources')}</strong>
      <p>{t(found ? 'claudeAuthFoundButRejected' : 'claudeAuthMissing')}</p>
      <p className="wb-muted">
        {t('claudeConfigUsed')} <code>{setup.configDirectory}</code>
      </p>
      <ul>
        <li>{t(setup.environmentAuth ? 'claudeEnvAuthPresent' : 'claudeEnvAuthMissing')}</li>
        <li>
          {t(
            setup.settingsAuth || setup.loginFilePresent || setup.keyHelperPresent
              ? 'claudeFileAuthPresent'
              : 'claudeFileAuthMissing',
          )}
        </li>
        <li>{t(setup.endpointPresent ? 'claudeEndpointPresent' : 'claudeEndpointMissing')}</li>
      </ul>
      <p>{t('claudeAuthRecovery')}</p>
    </div>
  );
}
