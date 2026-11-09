import { useState } from 'react';
import { useSessionTasks } from './useSessionTasks';
import { advanceRun } from '../domain/runtime/engine';
import { createRun } from '../domain/runtime/plan';
import { chatRequest, createSession, message, replyMessage, workflowCommand } from '../domain/runtime/chat';
import type { AgentPort, ConversationSession, WorkflowRun } from '../domain/runtime/types';
import type { AgentProfile, WorkbenchDocument } from '../domain/workflow';
import { DesktopAgentPort } from '../services/conversation-api';
import { useConversationStore } from './useConversationStore';
import type { ExecutionPort, FrameworkProfile } from '../domain/execution/types';
import { DesktopExecutionPort } from '../services/execution-api';
import { sessionActions } from './session-actions';
import { runReviewActions } from './run-review-actions';
import { recordedAgent } from '../services/recorded-agent';
import { transcriptStore } from '../services/transcript-store';
import type { ChatContextMode } from '../domain/runtime/chat-context';
import { runRetryAction } from './run-retry-action';
import { designProposalActions } from './design-proposal-actions';
import { invokedWorkflow } from '../domain/runtime/workflow-selection';
import { caseProposalActions } from './case-proposal-actions';

export function useConversations(
  profiles: AgentProfile[],
  saved: WorkbenchDocument | null,
  providedPort?: AgentPort,
  providedExecutionPort?: ExecutionPort,
  workflows?: WorkbenchDocument[],
) {
  const store = useConversationStore();
  const [nativePort] = useState(() => new DesktopAgentPort());
  const port = providedPort ?? nativePort;
  const [nativeExecution] = useState(() => new DesktopExecutionPort());
  const executionPort = providedExecutionPort ?? nativeExecution;
  const [selectedRunId, setSelectedRunId] = useState('');
  const tasks = useSessionTasks(store.activeId);
  const { perform } = tasks;
  const { session, changeSession, updateRun, setError } = store;
  const selectedWorkflow = session?.draft?.workflowId
    ? (workflows?.find((item) => item.definition.id === session.draft?.workflowId) ?? null)
    : saved;
  async function drive(run: WorkflowRun, controller: AbortController) {
    let current = run;
    await advanceRun(
      run,
      recordedAgent(port, () => current),
      controller.signal,
      (value) => {
        current = value;
        updateRun(run.sessionId, value);
        for (const step of Object.values(value.steps))
          if (step.turnId && step.errorCode) transcriptStore.validation(step.turnId, step.errorCode);
      },
      () => {},
      executionPort,
    );
  }
  function selectSession(id: string) {
    store.setActiveId(id);
    setSelectedRunId('');
    setError(null);
  }
  function newSession() {
    const value = createSession(profiles[0]?.id ?? 'codex-native');
    changeSession(value);
    selectSession(value.id);
  }
  async function send(
    text: string,
    invoke: boolean,
    profileId: string,
    framework?: FrameworkProfile,
    useNodeBindings = false,
    contextMode: ChatContextMode = 'recent',
    onAccepted?: () => void,
  ): Promise<boolean> {
    const current = session ?? createSession(profileId);
    if (tasks.isSessionBusy(current.id) || !text.trim()) return false;
    let accepted = false;
    await perform(async (controller) => {
      if (current.activeTurnId) throw new Error('previous_turn_active');
      const profile = profiles.find((item) => item.id === profileId);
      const workflow = invokedWorkflow(text, selectedWorkflow, workflows);
      const command = workflowCommand(text, workflow?.definition.id);
      const value: ConversationSession = {
        ...current,
        profileId,
        title: current.title || text.slice(0, 32),
        messages: [...current.messages, message('user', text)],
      };
      if (!profile) throw new Error('profile_missing');
      if (invoke || command.invoke) {
        if (!workflow) throw new Error('workflow_not_saved');
        if (current.runs.some((run) => ['ready', 'running', 'awaiting_review'].includes(run.status)))
          throw new Error('run_in_progress');
        const run = createRun(
          workflow,
          value.id,
          command.spec,
          profiles,
          profileId,
          framework,
          useNodeBindings ? 'bindings' : 'session',
        );
        value.runs = [...value.runs, run];
        setSelectedRunId(run.id);
        changeSession(value);
        store.setActiveId(value.id);
        accepted = true;
        store.acceptComposerDraft(value.id, text);
        onAccepted?.();
        await drive(run, controller);
      } else {
        const request = chatRequest(value, profile, contextMode);
        value.activeTurnId = request.turnId;
        changeSession(value);
        store.setActiveId(value.id);
        accepted = true;
        store.acceptComposerDraft(value.id, text);
        onAccepted?.();
        const result = await recordedAgent(port).send(
          request,
          (event) => tasks.onEvent(value.id, event),
          controller.signal,
        );
        const settled = { ...value, messages: [...value.messages, replyMessage(result, request)] };
        delete settled.activeTurnId;
        changeSession(settled);
      }
    }, current.id);
    return accepted;
  }
  async function stopRecovered() {
    if (!session?.activeTurnId) return;
    await perform(async () => {
      await port.cancel(session.activeTurnId!);
      const settled = { ...session };
      delete settled.activeTurnId;
      changeSession(settled);
    });
  }
  async function closeExecution(run: WorkflowRun) {
    await perform(async () => {
      if (store.getSession(run.sessionId)?.runs.find((item) => item.id === run.id) !== run)
        throw new Error('approval_stale');
      for (const step of Object.values(run.steps))
        if (step.executionId) await executionPort.cancel(step.executionId);
      if (store.getSession(run.sessionId)?.runs.find((item) => item.id === run.id) !== run)
        throw new Error('approval_stale');
      updateRun(run.sessionId, { ...run, status: 'cancelled' });
    }, run.sessionId);
  }
  function cancel(run?: WorkflowRun) {
    if (tasks.isSessionBusy(run?.sessionId ?? store.activeId)) {
      tasks.cancel(run?.sessionId ?? store.activeId);
      return;
    }
    if (run && run.status === 'awaiting_review') updateRun(run.sessionId, { ...run, status: 'cancelled' });
  }
  return {
    selectedWorkflow,
    ...store,
    ...designProposalActions(store, tasks, port, profiles),
    ...caseProposalActions(store, tasks, port, profiles),
    setActiveId: selectSession,
    busy: tasks.busy,
    anyBusy: tasks.anyBusy,
    stream: tasks.stream,
    progress: tasks.progress,
    error: tasks.error ?? store.error,
    isSessionBusy: tasks.isSessionBusy,
    send,
    newSession,
    retry: runRetryAction(store, perform, port, executionPort, drive),
    cancel,
    stopRecovered,
    closeExecution,
    selectedRunId,
    setSelectedRunId,
    ...runReviewActions({
      perform,
      updateRun,
      drive,
      getRun: (sessionId, runId) => store.getSession(sessionId)?.runs.find((item) => item.id === runId),
    }),
    ...sessionActions(
      store,
      (id) => tasks.isSessionBusy(id),
      () => setSelectedRunId(''),
    ),
  };
}

export type Conversations = ReturnType<typeof useConversations>;
