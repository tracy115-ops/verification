import type { AgentProfile, WorkbenchDocument } from '../../domain/workflow';
import type { FrameworkProfile } from '../../domain/execution/types';
import type { ComposerDraft } from '../../domain/runtime/composer-draft';
import { useI18n } from '../../shared/i18n/context';
import { supportsInference } from '../../domain/agent-capabilities';

export function ComposerSelectors({
  draft,
  profiles,
  saved,
  frameworks,
  canPropose,
  change,
}: {
  draft: ComposerDraft;
  profiles: AgentProfile[];
  saved: WorkbenchDocument | null;
  frameworks: FrameworkProfile[];
  canPropose: boolean;
  change: (patch: Partial<ComposerDraft>) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="session-composer-controls">
      <label className="wb-field">
        <span className="wb-sr-only">{t('sessionAgent')}</span>
        <select
          className="workbench-select"
          value={draft.profileId}
          onChange={(event) => change({ profileId: event.target.value })}
        >
          {!profiles.some((item) => item.id === draft.profileId) && (
            <option value={draft.profileId} disabled>
              {t('composerMissingProfile')}
            </option>
          )}
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id} disabled={!supportsInference(profile)}>
              {profile.name}
              {!supportsInference(profile) ? ` · ${t('providerRuntimeUnsupported')}` : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="wb-field">
        <span className="wb-sr-only">{t('savedWorkflow')}</span>
        <select
          className="workbench-select"
          value={draft.editDesign ? 'design' : draft.invoke ? 'workflow' : 'chat'}
          onChange={(event) =>
            change({ invoke: event.target.value === 'workflow', editDesign: event.target.value === 'design' })
          }
        >
          <option value="chat">{t('chatMode')}</option>
          {(canPropose || draft.editDesign) && (
            <option value="design" disabled={!canPropose}>
              {t('designProposalMode')}
            </option>
          )}
          <option value="workflow" disabled={!saved}>
            {saved ? `${saved.definition.name} · r${saved.revision}` : t('noSavedWorkflow')}
          </option>
        </select>
      </label>
      {draft.invoke && !draft.editDesign && (
        <label className="wb-field">
          <span className="wb-sr-only">{t('executionScope')}</span>
          <select
            className="workbench-select"
            value={draft.frameworkId}
            onChange={(event) => change({ frameworkId: event.target.value })}
          >
            <option value="">{t('designScopeCompact')}</option>
            {draft.frameworkId && !frameworks.some((item) => item.id === draft.frameworkId) && (
              <option value={draft.frameworkId} disabled>
                {t('composerMissingFramework')}
              </option>
            )}
            {frameworks.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {t('verificationScope')} · {profile.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
