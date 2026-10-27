import { useState } from 'react';
import type { AgentProfile } from '../../domain/workflow';
import { useI18n } from '../../shared/i18n/context';

export function NativeModels({
  profiles,
  saveProfile,
}: {
  profiles: AgentProfile[];
  saveProfile: (profile: AgentProfile) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="settings-native-models">
      <h2>{t('nativeModels')}</h2>
      <p className="wb-muted">{t('nativeModelsHint')}</p>
      {profiles
        .filter((profile) => profile.protocol === 'native')
        .map((profile) =>
          profile.driver === 'codeagent' ? (
            <div className="settings-model-row" key={profile.id}>
              <strong>{profile.name}</strong>
              <div>
                <p>{t('codeagentManagedModel')}</p>
                <code>codeagent --dangerously-skip-permissions</code>
                <small className="wb-muted">{t('codeagentCompatibilityHint')}</small>
              </div>
            </div>
          ) : (
            <ModelEditor key={`${profile.id}-${profile.model}`} profile={profile} save={saveProfile} />
          ),
        )}
    </section>
  );
}
function ModelEditor({ profile, save }: { profile: AgentProfile; save: (profile: AgentProfile) => void }) {
  const { t } = useI18n();
  const [model, setModel] = useState(profile.model);
  return (
    <form
      className="settings-model-row"
      onSubmit={(event) => {
        event.preventDefault();
        save({ ...profile, model: model.trim() });
      }}
    >
      <strong>{profile.name}</strong>
      <label className="wb-field">
        {t('model')} · {profile.name}
        <input
          className="workbench-input"
          required
          maxLength={200}
          value={model}
          placeholder={t('modelRequiredHint')}
          onChange={(event) => setModel(event.target.value)}
        />
      </label>
      <button className="workbench-btn" type="submit" disabled={!model.trim()}>
        {t('saveModel')}
      </button>
    </form>
  );
}
