import { useState } from 'react';
import { RefreshCw, Terminal } from 'lucide-react';
import type { AgentProfile } from '../../domain/workflow';
import { hasDesktopBridge, probeAgents, type AgentProbe } from '../../services/agent-api';
import { isMessageKey, useI18n } from '../../shared/i18n/context';
import type { MessageKey } from '../../shared/i18n/messages';
import { Status } from '../../shared/components/Status';
import { ProfileForm } from './ProfileForm';
import { NativeModels } from './NativeModels';
import { AgentProfileRow } from './ProfileProbeStatus';

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
      setProbes([]);
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
        {(['codeagent', 'codex', 'claude', 'pi'] as const).map((driver) => {
          const probe = probes.find((item) => item.driver === driver);
          const found = probe?.status === 'found';
          return (
            <section className="settings-cli" key={driver}>
              <Terminal size={22} />
              <h3>{driver}</h3>
              <Status tone={found ? 'success' : probe?.executable ? 'warning' : 'neutral'}>
                {t(
                  !probe
                    ? 'notProbed'
                    : found
                      ? 'found'
                      : probe.status === 'missing'
                        ? 'missing'
                        : probe?.executable
                          ? 'cliEntryDetected'
                          : 'probeError',
                )}
              </Status>
              {probe?.version && <p className="wb-code">{probe.version}</p>}
              {probe?.executable && <p className="settings-executable">{probe.executable}</p>}
              {probe?.reason && isMessageKey(probe.reason) && <p className="wb-muted">{t(probe.reason)}</p>}
            </section>
          );
        })}
      </div>
      <h2>{t('profiles')}</h2>
      <p className="wb-muted">{t('profileProbeScope')}</p>
      <div className="settings-profiles">
        {profiles.map((profile) => (
          <AgentProfileRow
            key={profile.id}
            profile={profile}
            probe={probes.find((probe) => probe.driver === profile.driver)}
          />
        ))}
      </div>
      <NativeModels profiles={profiles} saveProfile={addProfile} />
      <ProfileForm addProfile={addProfile} />
    </div>
  );
}
