import { useRef, useState } from 'react';
import { Paperclip, Send, Square } from 'lucide-react';
import type { Conversations } from '../../app/useConversations';
import type { AgentProfile, WorkbenchDocument } from '../../domain/workflow';
import { hasDesktopBridge } from '../../services/agent-api';
import { useI18n } from '../../shared/i18n/context';
import type { FrameworkProfile } from '../../domain/execution/types';
import { emptyComposerDraft, type ComposerDraft } from '../../domain/runtime/composer-draft';
import { ChatContextControl } from './ChatContextControl';
import { ComposerInput } from './ComposerInput';

export function ConversationComposer({
  actions,
  profiles,
  saved,
  dirty,
  openWorkflow,
  frameworks,
}: {
  actions: Conversations;
  profiles: AgentProfile[];
  saved: WorkbenchDocument | null;
  dirty: boolean;
  openWorkflow: () => void;
  frameworks: FrameworkProfile[];
}) {
  const { t } = useI18n();
  const fallbackProfile = actions.session?.profileId ?? profiles[0]?.id ?? '';
  const draft = actions.session?.draft ?? emptyComposerDraft(fallbackProfile);
  const { text, invoke, profileId, frameworkId, useNodeBindings, contextMode } = draft;
  const changeDraft = (patch: Partial<ComposerDraft>) => actions.updateComposerDraft(patch, fallbackProfile);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  async function send() {
    if (actions.busy || !hasDesktopBridge() || !text.trim()) return;
    const framework = invoke && frameworkId ? frameworks.find((item) => item.id === frameworkId) : undefined;
    if (invoke && frameworkId && !framework) {
      actions.setError('execution_invalid');
      return;
    }
    await actions.send(text, invoke, profileId, framework, useNodeBindings, contextMode);
  }
  async function attach(input?: File) {
    if (!input) return;
    const sessionId = actions.updateComposerDraft({}, fallbackProfile);
    if (!sessionId) return;
    try {
      if (input.size > 131072) {
        setAttachmentError(sessionId);
        return;
      }
      const content = await input.text();
      const latest = actions.getComposerDraft(sessionId);
      if (!latest) return;
      if (content.length + latest.text.length > 39998) {
        setAttachmentError(sessionId);
        return;
      }
      actions.updateComposerDraft(
        { text: latest.text ? `${latest.text}\n\n${content}` : content },
        fallbackProfile,
        sessionId,
      );
      setAttachmentError(null);
    } catch {
      setAttachmentError(sessionId);
    }
  }
  return (
    <div className="session-composer">
      <div className="session-composer-controls">
        <label className="wb-field">
          <span className="wb-sr-only">{t('sessionAgent')}</span>
          <select
            className="workbench-select"
            value={profileId}
            onChange={(event) => changeDraft({ profileId: event.target.value })}
          >
            {!profiles.some((item) => item.id === profileId) && (
              <option value={profileId} disabled>
                {t('composerMissingProfile')}
              </option>
            )}
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
        <label className="wb-field">
          <span className="wb-sr-only">{t('savedWorkflow')}</span>
          <select
            className="workbench-select"
            value={invoke ? 'workflow' : 'chat'}
            onChange={(event) => changeDraft({ invoke: event.target.value === 'workflow' })}
          >
            <option value="chat">{t('chatMode')}</option>
            <option value="workflow" disabled={!saved}>
              {saved ? `${saved.definition.name} · r${saved.revision}` : t('noSavedWorkflow')}
            </option>
          </select>
        </label>
        {invoke && (
          <label className="wb-field">
            <span className="wb-sr-only">{t('executionScope')}</span>
            <select
              className="workbench-select"
              value={frameworkId}
              onChange={(event) => changeDraft({ frameworkId: event.target.value })}
            >
              <option value="">{t('designScopeCompact')}</option>
              {frameworkId && !frameworks.some((item) => item.id === frameworkId) && (
                <option value={frameworkId} disabled>
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
      {!invoke && (
        <ChatContextControl
          messages={actions.session?.messages ?? []}
          draft={text}
          mode={contextMode}
          change={(contextMode) => changeDraft({ contextMode })}
          disabled={false}
        />
      )}
      {invoke && (
        <label className="session-binding-choice wb-muted">
          <input
            type="checkbox"
            checked={useNodeBindings}
            onChange={(event) => changeDraft({ useNodeBindings: event.target.checked })}
          />{' '}
          {t('useNodeBindings')}
        </label>
      )}
      {invoke && dirty && <p className="session-scope">{t('unsavedWorkflowHint')}</p>}
      {!saved && invoke && (
        <button className="workbench-btn wb-text" onClick={openWorkflow}>
          {t('chooseFlowFirst')}
        </button>
      )}
      <ComposerInput value={text} disabled={false} change={(text) => changeDraft({ text })} send={send} />
      {actions.busy && <small className="wb-muted">{t('composerDraftWhileRunning')}</small>}
      {attachmentError === actions.activeId && (
        <p className="wb-error" role="alert">
          {t('prompt_too_large')}
        </p>
      )}
      <div className="session-composer-actions">
        <button className="workbench-btn wb-text" onClick={() => file.current?.click()}>
          <Paperclip size={16} />
          {t('attachSpec')}
        </button>
        <input
          ref={file}
          type="file"
          accept=".md,.txt,text/plain,text/markdown"
          hidden
          onChange={(event) => {
            void attach(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        {actions.busy ? (
          <button className="workbench-btn" onClick={() => actions.cancel()}>
            <Square size={14} />
            {t('stopGeneration')}
          </button>
        ) : (
          <button
            className="workbench-btn wb-primary"
            disabled={!hasDesktopBridge() || !text.trim()}
            title={t('composerKeyboardHint')}
            onClick={() => void send()}
          >
            <Send size={15} />
            {t(invoke ? 'invokeWorkflow' : 'sendMessage')}
          </button>
        )}
      </div>
    </div>
  );
}
