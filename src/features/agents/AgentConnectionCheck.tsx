import type { AgentProfile } from '../../domain/workflow';
import { nativeAgentFields } from '../../domain/runtime/profile';
import { hasDesktopBridge } from '../../services/agent-api';
import type { useAgentConnection } from './useAgentConnection';
import { isMessageKey, useI18n } from '../../shared/i18n/context';
import { ClaudeAuthHelp } from './ClaudeAuthHelp';
import { NativeConfigSummary } from './NativeConfigSummary';

export function AgentConnectionCheck({
  profile,
  blocked = false,
  compact = false,
  connection,
}: {
  profile: AgentProfile;
  blocked?: boolean;
  compact?: boolean;
  connection: ReturnType<typeof useAgentConnection>;
}) {
  const { t, locale } = useI18n();
  const { result, busy } = connection;
  let reason: string | undefined;
  try {
    nativeAgentFields(profile);
  } catch (error) {
    reason = error instanceof Error ? error.message : 'cli_failed';
  }
  return (
    <section className="settings-connection-check" aria-label={`${t('connectionCheck')} · ${profile.name}`}>
      <div>
        {!compact && (
          <strong>
            {profile.name} · {t('connectionCheck')}
          </strong>
        )}
        <small className="wb-muted">{t('connectionCheckHint')}</small>
        <details className="settings-test-source">
          <summary>{t('connectionSavedSource')}</summary>
          <NativeConfigSummary profile={profile} />
        </details>
        {reason && (
          <small>
            {reason === 'model_required'
              ? t('agentSetupMissingModel')
              : isMessageKey(reason)
                ? t(reason)
                : t('cli_failed')}
          </small>
        )}
        {result && (
          <p role="status">
            {t(
              busy
                ? 'connectionChecking'
                : result.status === 'passed'
                  ? 'connectionPassed'
                  : 'connectionFailed',
            )}
            {result.checkedAt &&
              ` · ${new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(result.checkedAt))}`}
          </p>
        )}
        {result?.errorCode && (
          <p className="wb-error">{isMessageKey(result.errorCode) ? t(result.errorCode) : t('cli_failed')}</p>
        )}
        {profile.driver === 'claude' && result?.errorCode === 'cli_auth_failed' && (
          <ClaudeAuthHelp profile={profile} />
        )}
      </div>
      {busy ? (
        <button className="workbench-btn" onClick={connection.cancel}>
          {t('cancelRun')}
        </button>
      ) : (
        <button
          className="workbench-btn"
          disabled={blocked || !hasDesktopBridge() || !!reason}
          onClick={() => connection.start()}
        >
          {t('connectionCheckSend')}
        </button>
      )}
    </section>
  );
}
