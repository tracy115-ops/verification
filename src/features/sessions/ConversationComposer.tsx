import { useRef, useState } from 'react';
import { Paperclip, Send, Square } from 'lucide-react';
import type { Conversations } from '../../app/useConversations';
import type { AgentProfile, WorkbenchDocument } from '../../domain/workflow';
import { hasDesktopBridge } from '../../services/agent-api';
import { useI18n } from '../../shared/i18n/context';
import type { FrameworkProfile } from '../../domain/execution/types';

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
  const [text, setText] = useState('');
  const [invoke, setInvoke] = useState(false);
  const [profileId, setProfileId] = useState(actions.session?.profileId ?? profiles[0]?.id ?? '');
  const [attachmentError, setAttachmentError] = useState(false);
  const [frameworkId, setFrameworkId] = useState('');
  const file = useRef<HTMLInputElement>(null);
  async function send() {
    const framework = invoke && frameworkId ? frameworks.find((item) => item.id === frameworkId) : undefined;
    if (invoke && frameworkId && !framework) {
      actions.setError('execution_invalid');
      return;
    }
    if (await actions.send(text, invoke, profileId, framework)) setText('');
  }
  async function attach(input?: File) {
    if (!input) return;
    try {
      if (input.size > 131072) {
        setAttachmentError(true);
        return;
      }
      const content = await input.text();
      if (content.length + text.length > 39998) {
        setAttachmentError(true);
        return;
      }
      setText((current) => (current ? `${current}\n\n${content}` : content));
      setAttachmentError(false);
    } catch {
      setAttachmentError(true);
    }
  }
  return (
    <div className="session-composer">
      <div className="session-composer-controls">
        <label className="wb-field">
          <span className="wb-sr-only">{t('sessionAgent')}</span>
          <select
            className="workbench-select"
            disabled={actions.busy}
            value={profileId}
            onChange={(event) => setProfileId(event.target.value)}
          >
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
            disabled={actions.busy}
            value={invoke ? 'workflow' : 'chat'}
            onChange={(event) => setInvoke(event.target.value === 'workflow')}
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
              disabled={actions.busy}
              value={frameworkId}
              onChange={(event) => setFrameworkId(event.target.value)}
            >
              <option value="">{t('designScopeCompact')}</option>
              {frameworks.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {t('verificationScope')} · {profile.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {invoke && dirty && <p className="session-scope">{t('unsavedWorkflowHint')}</p>}
      {!saved && invoke && (
        <button className="workbench-btn wb-text" onClick={openWorkflow}>
          {t('chooseFlowFirst')}
        </button>
      )}
      <label className="wb-field">
        <span className="wb-sr-only">{t('composerPlaceholder')}</span>
        <textarea
          className="workbench-textarea"
          value={text}
          maxLength={40000}
          disabled={actions.busy}
          placeholder={t('composerPlaceholder')}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      {attachmentError && (
        <p className="wb-error" role="alert">
          {t('prompt_too_large')}
        </p>
      )}
      <div className="session-composer-actions">
        <button
          className="workbench-btn wb-text"
          disabled={actions.busy}
          onClick={() => file.current?.click()}
        >
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
