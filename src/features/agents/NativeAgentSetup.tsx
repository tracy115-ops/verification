import type { AgentProfile } from '../../domain/workflow';
import { useI18n } from '../../shared/i18n/context';
import { NativeLaunchEditor } from './NativeLaunchEditor';
import { AgentConnectionCheck } from './AgentConnectionCheck';
import { ModelHintsPicker } from './ModelHintsPicker';
import { ClaudeSettingsSources } from './ClaudeSettingsSources';
import { NativeConfigSummary } from './NativeConfigSummary';
import { useAgentConnection } from './useAgentConnection';

export function NativeAgentSetup({
  profile,
  save,
  model,
  changeModel,
}: {
  profile: AgentProfile;
  save: (profile: AgentProfile) => void;
  model: string;
  changeModel: (model: string) => void;
}) {
  const { t } = useI18n();
  const internal = profile.driver === 'codeagent';
  const dirty = !internal && model.trim() !== profile.model;
  const connection = useAgentConnection(profile);
  return (
    <article className="settings-agent-setup" aria-label={profile.name}>
      <header>
        <h3>{profile.name}</h3>
        <p className="wb-muted">{t('agentSetupReuse')}</p>
      </header>
      <section>
        <h4>{t('agentSetupConfigStep')}</h4>
        <NativeConfigSummary profile={profile} />
        {profile.driver === 'claude' && (
          <ClaudeSettingsSources
            profile={profile}
            save={save}
            connection={connection}
            blocked={dirty || !profile.model.trim()}
          />
        )}
        <NativeLaunchEditor key={`launch-${JSON.stringify(profile)}`} profile={profile} save={save} />
      </section>
      <section>
        <h4>{t('agentSetupModelStep')}</h4>
        {!internal && (
          <ModelHintsPicker
            key={`${profile.driver}-${JSON.stringify(profile.launch)}`}
            profile={profile}
            adopt={changeModel}
          />
        )}
        {internal ? (
          <p>{t('codeagentManagedModel')}</p>
        ) : (
          <form
            className="settings-model-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (model.trim()) save({ ...profile, model: model.trim() });
            }}
          >
            <label className="wb-field">
              {t('model')} · {profile.name}
              <input
                className="workbench-input"
                aria-label={`${t('model')} · ${profile.name}`}
                value={model}
                required
                maxLength={200}
                placeholder={t('modelRequiredHint')}
                onChange={(event) => changeModel(event.target.value)}
              />
              <small className="wb-muted">{t('agentSetupModelHint')}</small>
              {/\s/.test(model.trim()) && (
                <small className="wb-error">{t('agentModelDisplayNameWarning')}</small>
              )}
            </label>
            <button className="workbench-btn" disabled={!model.trim()}>
              {t('saveModel')}
            </button>
          </form>
        )}
        {dirty && (
          <p role="status" className="wb-muted">
            {t('agentSetupUnsaved')}
          </p>
        )}
      </section>
      <section>
        <h4>{t('agentSetupTestStep')}</h4>
        <AgentConnectionCheck profile={profile} blocked={dirty} compact connection={connection} />
      </section>
    </article>
  );
}
