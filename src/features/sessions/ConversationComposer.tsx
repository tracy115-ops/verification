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
import { ComposerSelectors } from './ComposerSelectors';
import { prepareInvocation } from '../../domain/runtime/preparation';
import { InvocationPreparation } from './InvocationPreparation';

export function ConversationComposer({
  actions,
  profiles,
  saved,
  dirty,
  openWorkflow,
  openSettings,
  frameworks,
}: {
  actions: Conversations;
  profiles: AgentProfile[];
  saved: WorkbenchDocument | null;
  dirty: boolean;
  openWorkflow: () => void;
  openSettings: () => void;
  frameworks: FrameworkProfile[];
}) {
  const { t } = useI18n();
  const fallbackProfile = actions.session?.profileId ?? profiles[0]?.id ?? '';
  const draft = actions.session?.draft ?? emptyComposerDraft(fallbackProfile);
  const { text, invoke, profileId, frameworkId, useNodeBindings, contextMode } = draft;
  const preparation = prepareInvocation(draft, saved, profiles, frameworks);
  const changeDraft = (patch: Partial<ComposerDraft>) => actions.updateComposerDraft(patch, fallbackProfile);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const run =
    actions.session?.runs.find((item) => item.id === actions.selectedRunId) ?? actions.session?.runs.at(-1);
  const canPropose =
    run && Object.values(run.artifacts).some((item) => ['TestDesign', 'TestDesignDraft'].includes(item.type));
  async function send() {
    if (actions.busy || !hasDesktopBridge() || !text.trim()) return;
    if (preparation?.issues.length) return;
    if (draft.editDesign) {
      if (!run || !canPropose) {
        actions.setError('design_proposal_unavailable');
        return;
      }
      await actions.proposeDesign(run, text, profileId);
      return;
    }
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
      <ComposerSelectors
        draft={draft}
        profiles={profiles}
        saved={saved}
        frameworks={frameworks}
        canPropose={!!canPropose}
        change={changeDraft}
      />
      {!invoke && !draft.editDesign && (
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
      <ComposerInput
        value={text}
        disabled={false}
        change={(text) => changeDraft({ text })}
        send={send}
        placeholderKey={draft.editDesign ? 'designProposalPlaceholder' : 'composerPlaceholder'}
      />
      <InvocationPreparation
        preparation={preparation}
        saved={saved}
        openSettings={openSettings}
        openWorkflow={openWorkflow}
      />
      {draft.editDesign && <small className="wb-muted">{t('designProposalModeHint')}</small>}
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
            disabled={!hasDesktopBridge() || !text.trim() || !!preparation?.issues.length}
            title={t('composerKeyboardHint')}
            onClick={() => void send()}
          >
            <Send size={15} />
            {t(draft.editDesign ? 'designProposalGenerate' : invoke ? 'invokeWorkflow' : 'sendMessage')}
          </button>
        )}
      </div>
    </div>
  );
}
