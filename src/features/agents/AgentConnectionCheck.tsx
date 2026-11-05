import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { AgentProfile } from '../../domain/workflow';
import { nativeAgentFields } from '../../domain/runtime/profile';
import { DesktopAgentPort } from '../../services/conversation-api';
import { hasDesktopBridge } from '../../services/agent-api';
import {
  checkAgentConnection,
  connectionFor,
  connectionSnapshot,
  subscribeConnections,
} from '../../services/agent-connection';
import { isMessageKey, useI18n } from '../../shared/i18n/context';

export function AgentConnectionCheck({ profile }: { profile: AgentProfile }) {
  const { t, locale } = useI18n();
  const snapshot = useSyncExternalStore(subscribeConnections, connectionSnapshot);
  const result = connectionFor(profile, snapshot);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const busy = result?.status === 'checking';
  let reason: string | undefined;
  try {
    nativeAgentFields(profile);
  } catch (error) {
    reason = error instanceof Error ? error.message : 'cli_failed';
  }
  return (
    <section className="settings-model-row" aria-label={`${t('connectionCheck')} · ${profile.name}`}>
      <div>
        <strong>
          {profile.name} · {t('connectionCheck')}
        </strong>
        <small className="wb-muted">{t('connectionCheckHint')}</small>
        {reason && <small>{isMessageKey(reason) ? t(reason) : t('cli_failed')}</small>}
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
      </div>
      {busy ? (
        <button className="workbench-btn" onClick={() => controller.current?.abort()}>
          {t('cancelRun')}
        </button>
      ) : (
        <button
          className="workbench-btn"
          disabled={!hasDesktopBridge() || !!reason}
          onClick={() => {
            controller.current = new AbortController();
            void checkAgentConnection(profile, new DesktopAgentPort(), controller.current.signal);
          }}
        >
          {t('connectionCheckSend')}
        </button>
      )}
    </section>
  );
}
