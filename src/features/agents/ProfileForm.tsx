import { useState } from 'react';
import { Plus } from 'lucide-react';
import { profileIsCompatible, type AgentProfile, type DriverId, type Protocol } from '../../domain/workflow';
import { useI18n } from '../../shared/i18n/context';

const protocolOptions: Record<DriverId, Protocol[]> = {
  codex: ['native', 'openai-responses'],
  claude: ['native', 'anthropic-messages'],
  pi: ['native', 'openai-responses', 'anthropic-messages', 'openai-completions'],
};

export function ProfileForm({ addProfile }: { addProfile: (profile: AgentProfile) => void }) {
  const { t } = useI18n();
  const [error, setError] = useState(false);
  const [profile, setProfile] = useState<AgentProfile>({
    id: `agent-${crypto.randomUUID()}`,
    name: '',
    driver: 'codex',
    protocol: 'openai-responses',
    baseUrl: '',
    model: '',
    credentialRef: '',
  });
  function changeDriver(value: string) {
    if (value !== 'claude' && value !== 'codex' && value !== 'pi') return;
    setProfile({ ...profile, driver: value, protocol: protocolOptions[value][1] });
  }
  function changeProtocol(value: string) {
    const protocol = protocolOptions[profile.driver].find((item) => item === value);
    if (protocol)
      setProfile({
        ...profile,
        protocol,
        ...(protocol === 'native' ? { baseUrl: '', credentialRef: '' } : {}),
      });
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!profileIsCompatible(profile)) {
      setError(true);
      return;
    }
    addProfile(profile);
    setError(false);
    setProfile({ ...profile, id: `agent-${crypto.randomUUID()}`, name: '' });
  }
  return (
    <form className="settings-profile-form" onSubmit={submit}>
      <div className="wb-section-heading">
        <h2>{t('addProfile')}</h2>
        <Plus size={18} />
      </div>
      <div className="settings-fields">
        <label className="wb-field">
          {t('profileName')}
          <input
            className="workbench-input"
            required
            value={profile.name}
            onChange={(event) => setProfile({ ...profile, name: event.target.value })}
          />
        </label>
        <label className="wb-field">
          {t('driver')}
          <select
            className="workbench-select"
            value={profile.driver}
            onChange={(event) => changeDriver(event.target.value)}
          >
            <option>codex</option>
            <option>claude</option>
            <option>pi</option>
          </select>
        </label>
        <label className="wb-field">
          {t('protocol')}
          <select
            className="workbench-select"
            value={profile.protocol}
            onChange={(event) => changeProtocol(event.target.value)}
          >
            {protocolOptions[profile.driver].map((item) => (
              <option key={item} value={item}>
                {item === 'native' ? t('native') : item}
              </option>
            ))}
          </select>
        </label>
        <label className="wb-field">
          {t('model')}
          <input
            className="workbench-input"
            value={profile.model}
            placeholder={profile.protocol === 'native' ? t('nativeModel') : ''}
            onChange={(event) => setProfile({ ...profile, model: event.target.value })}
          />
        </label>
        <label className="wb-field">
          {t('baseUrl')}
          <input
            className="workbench-input"
            type="url"
            disabled={profile.protocol === 'native'}
            value={profile.baseUrl}
            onChange={(event) => setProfile({ ...profile, baseUrl: event.target.value })}
          />
        </label>
        <label className="wb-field">
          {t('credential')}
          <input
            className="workbench-input"
            disabled={profile.protocol === 'native'}
            value={profile.credentialRef}
            onChange={(event) => setProfile({ ...profile, credentialRef: event.target.value })}
          />
        </label>
      </div>
      <p className="wb-muted">{t('credentialHint')}</p>
      {error && (
        <p className="wb-error" role="alert">
          {t('invalidProfile')}
        </p>
      )}
      <button className="workbench-btn wb-primary" type="submit">
        <Plus size={15} />
        {t('addProfile')}
      </button>
    </form>
  );
}
