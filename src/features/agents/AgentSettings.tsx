import { useState } from 'react';
import { Bot, RefreshCw, Terminal } from 'lucide-react';
import type { AgentProfile } from '../../domain/workflow';
import { hasDesktopBridge, probeAgents, type AgentProbe } from '../../services/agent-api';
import { useI18n } from '../../shared/i18n/context';
import type { MessageKey } from '../../shared/i18n/messages';
import { Status } from '../../shared/components/Status';
import { ProfileForm } from './ProfileForm';

export function AgentSettings({
  profiles,
  addProfile,
  notify,
}: {
  profiles: AgentProfile[];
  addProfile: (profile: AgentProfile) => void;
  notify: (key: MessageKey) => void;
}) {
  const { t } = useI18n();
  const [probes, setProbes] = useState<AgentProbe[]>([]);
  const [busy, setBusy] = useState(false);
  const desktop = hasDesktopBridge();
  async function detect() {
    setBusy(true);
    try {
      setProbes(await probeAgents());
    } catch {
      notify(desktop ? 'discoveryFailed' : 'browserOnly');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-shell">
      <div className="wb-section-heading">
        <div>
          <h2>{t('cliEntry')}</h2>
          <p className="wb-muted">{t('cliDescription')}</p>
        </div>
        <button className="workbench-btn wb-primary" disabled={busy || !desktop} onClick={detect}>
          <RefreshCw size={15} className={busy ? 'wb-spin' : ''} />
          {t(busy ? 'detecting' : 'detect')}
        </button>
      </div>
      {!desktop && <p className="wb-banner">{t('browserOnly')}</p>}
      <div className="settings-cli-grid">
        {(['codex', 'claude', 'pi'] as const).map((driver) => {
          const probe = probes.find((item) => item.driver === driver);
          const found = probe?.status === 'found';
          return (
            <section className="settings-cli" key={driver}>
              <Terminal size={22} />
              <h3>{driver}</h3>
              <Status tone={found ? 'success' : 'neutral'}>
                {t(
                  !probe
                    ? 'notProbed'
                    : found
                      ? 'found'
                      : probe.status === 'missing'
                        ? 'missing'
                        : 'probeError',
                )}
              </Status>
              {probe?.version && <p className="wb-code">{probe.version}</p>}
              {probe?.executable && <p className="settings-executable">{probe.executable}</p>}
            </section>
          );
        })}
      </div>
      <h2>{t('profiles')}</h2>
      <div className="settings-profiles">
        {profiles.map((profile) => (
          <div className="settings-profile-row" key={profile.id}>
            <span className="wb-icon-tile">
              <Bot size={18} />
            </span>
            <div>
              <strong>{profile.name}</strong>
              <small>
                {profile.driver} · {profile.protocol === 'native' ? t('native') : profile.protocol}
              </small>
            </div>
            <Status tone="warning">{t('notProbed')}</Status>
          </div>
        ))}
      </div>
      <ProfileForm addProfile={addProfile} />
    </div>
  );
}
