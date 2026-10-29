import type { AgentProfile } from '../../domain/workflow';
import type { AgentProbe } from '../../services/agent-api';
import { Status } from '../../shared/components/Status';
import { useI18n } from '../../shared/i18n/context';
import type { MessageKey } from '../../shared/i18n/messages';
import { Bot } from 'lucide-react';

function profileStatus(
  profile: AgentProfile,
  probe?: AgentProbe,
): {
  label: MessageKey;
  tone: 'neutral' | 'success' | 'warning';
} {
  if (profile.protocol !== 'native') return { label: 'providerEndpointUnchecked', tone: 'neutral' };
  if (!probe) return { label: 'profileCliNotChecked', tone: 'neutral' };
  if (probe.status === 'found') {
    return profile.driver !== 'codeagent' && !profile.model.trim()
      ? { label: 'profileCliNeedsModel', tone: 'warning' }
      : { label: 'profileCliDetected', tone: 'success' };
  }
  if (probe.status === 'missing') return { label: 'profileCliMissing', tone: 'warning' };
  return { label: probe.executable ? 'cliEntryDetected' : 'probeError', tone: 'warning' };
}

export function ProfileProbeStatus({ profile, probe }: { profile: AgentProfile; probe?: AgentProbe }) {
  const { t } = useI18n();
  const status = profileStatus(profile, probe);
  return <Status tone={status.tone}>{t(status.label)}</Status>;
}

export function AgentProfileRow({ profile, probe }: { profile: AgentProfile; probe?: AgentProbe }) {
  const { t } = useI18n();
  return (
    <div className="settings-profile-row">
      <span className="wb-icon-tile">
        <Bot size={18} />
      </span>
      <div>
        <strong>{profile.name}</strong>
        <small>
          {profile.driver} · {profile.protocol === 'native' ? t('native') : profile.protocol}
        </small>
        {profile.protocol === 'native' && probe?.status === 'found' && probe.version && (
          <small>{probe.version}</small>
        )}
      </div>
      <ProfileProbeStatus profile={profile} probe={probe} />
    </div>
  );
}
