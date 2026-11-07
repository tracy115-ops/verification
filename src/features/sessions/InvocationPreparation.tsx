import { useSyncExternalStore } from 'react';
import type { WorkflowPreparation } from '../../domain/runtime/preparation';
import type { WorkbenchDocument } from '../../domain/workflow';
import { connectionFor, connectionSnapshot, subscribeConnections } from '../../services/agent-connection';
import { isMessageKey, useI18n } from '../../shared/i18n/context';
import { nodeLabel } from '../workflows/node-label';

export function InvocationPreparation({
  preparation,
  saved,
  openSettings,
  openWorkflow,
}: {
  preparation?: WorkflowPreparation;
  saved: WorkbenchDocument | null;
  openSettings: () => void;
  openWorkflow: () => void;
}) {
  const { t, locale } = useI18n();
  const connections = useSyncExternalStore(subscribeConnections, connectionSnapshot);
  if (!preparation) return null;
  const count = new Intl.NumberFormat(locale);
  return (
    <details className="session-preparation">
      <summary>
        {t('preparationTitle')} · {t(preparation.issues.length ? 'preparationBlocked' : 'preparationReady')}
      </summary>
      <div className="session-preparation-body">
        <p>
          {t('preparationScope')}: {count.format(preparation.revision ?? 0)} /{' '}
          {count.format(preparation.stepCount)}
        </p>
        {preparation.issues.length > 0 && (
          <ul className="wb-error" aria-label={t('preparationBlocked')}>
            {preparation.issues.map((issue, index) => (
              <li key={index}>
                {issue.profileId && `${issue.profileId}: `}
                {t(isMessageKey(issue.code) ? issue.code : 'invalid_run')}
              </li>
            ))}
          </ul>
        )}
        <strong>{t('preparationAgents')}</strong>
        {preparation.agents.map((agent) => {
          const profile = agent.profile;
          const status = profile && connectionFor(profile, connections)?.status;
          return (
            <div key={agent.id} className="session-preparation-agent">
              <b>{profile?.name ?? agent.id}</b>
              <small>
                {profile?.driver} ·{' '}
                {profile?.model?.trim() ||
                  t(profile?.driver === 'codeagent' ? 'preparationInternalModel' : 'model_required')}
              </small>
              {profile?.launch?.executablePath && <small>{profile.launch.executablePath}</small>}
              {profile?.launch?.configDirectory && <small>{profile.launch.configDirectory}</small>}
              <small>{profile?.launch?.settingsFile || t('preparationInherited')}</small>
              <small>
                {agent.nodeIds
                  .map((id) => {
                    const node = saved?.definition.nodes.find((item) => item.id === id);
                    return node && saved ? nodeLabel(node, saved, t) : id;
                  })
                  .join(' · ')}
              </small>
              <small>
                {t(
                  status === 'passed'
                    ? 'preparationShortPassed'
                    : status === 'failed'
                      ? 'preparationShortFailed'
                      : status === 'checking'
                        ? 'preparationShortChecking'
                        : 'preparationShortUnknown',
                )}
              </small>
            </div>
          );
        })}
        {preparation.framework ? (
          <p>
            {preparation.framework.name} · {preparation.framework.targetUrl}
            <br />
            {t('preparationTargetUnknown')}
          </p>
        ) : !preparation.execution && preparation.stepCount > 0 ? (
          <p>{t('preparationDesignOnly')}</p>
        ) : null}
        <div className="session-preparation-actions">
          <button className="workbench-btn wb-text" onClick={openSettings}>
            {t('preparationConfigure')}
          </button>
          <button className="workbench-btn wb-text" onClick={openWorkflow}>
            {t('preparationWorkflow')}
          </button>
        </div>
      </div>
    </details>
  );
}
