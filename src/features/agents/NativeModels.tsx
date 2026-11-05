import { useState } from 'react';
import type { AgentProfile } from '../../domain/workflow';
import { useI18n } from '../../shared/i18n/context';
import { NativeAgentSetup } from './NativeAgentSetup';

export function NativeModels({
  profiles,
  saveProfile,
}: {
  profiles: AgentProfile[];
  saveProfile: (profile: AgentProfile) => void;
}) {
  const { t } = useI18n();
  const native = profiles.filter((profile) => profile.protocol === 'native');
  const [selected, setSelected] = useState(native[0]?.id ?? '');
  const [drafts, setDrafts] = useState<Record<string, { base: string; value: string }>>({});
  const profile = native.find((item) => item.id === selected) ?? native[0];
  return (
    <section className="settings-native-models">
      <h2>{t('agentSetupTitle')}</h2>
      <p className="wb-muted">{t('agentSetupIntro')}</p>
      <label className="wb-field settings-agent-picker">
        {t('agentSetupChoose')}
        <select
          className="workbench-select"
          value={profile?.id ?? ''}
          onChange={(event) => setSelected(event.target.value)}
        >
          {native.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {profile && (
        <NativeAgentSetup
          key={profile.id}
          profile={profile}
          save={saveProfile}
          model={drafts[profile.id]?.base === profile.model ? drafts[profile.id].value : profile.model}
          changeModel={(value) =>
            setDrafts((previous) => ({ ...previous, [profile.id]: { base: profile.model, value } }))
          }
        />
      )}
    </section>
  );
}
