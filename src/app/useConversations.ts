import { useEffect, useRef, useState } from 'react';
import { approveRun, advanceRun, retryRun } from '../domain/runtime/engine';
import { createRun } from '../domain/runtime/plan';
import { chatRequest, createSession, message, workflowCommand } from '../domain/runtime/chat';
import type { AgentEvent, AgentPort, ConversationSession, WorkflowRun } from '../domain/runtime/types';
import type { AgentProfile, WorkbenchDocument } from '../domain/workflow';
import { DesktopAgentPort } from '../services/conversation-api';
import { useConversationStore } from './useConversationStore';

export function useConversations(
  profiles: AgentProfile[],
  saved: WorkbenchDocument | null,
  providedPort?: AgentPort,
) {
  const store = useConversationStore();
  const [nativePort] = useState(() => new DesktopAgentPort());
  const port = providedPort ?? nativePort;
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');
  const abort = useRef<AbortController | null>(null);
  const { session, changeSession, updateRun, setError } = store;
  useEffect(() => () => abort.current?.abort(), []);
  async function perform(task: (controller: AbortController) => Promise<void>) {
    if (abort.current) return;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setStream('');
    setError(null);
    try {
      await task(controller);
    } catch (error) {
      setError(error instanceof Error ? error.message : typeof error === 'string' ? error : 'cli_failed');
    } finally {
      setBusy(false);
      setStream('');
      abort.current = null;
    }
  }
  function onEvent(event: AgentEvent) {
    if (event.type === 'text' && event.text) setStream((text) => text + event.text);
  }
  async function drive(run: WorkflowRun, controller: AbortController) {
    await advanceRun(run, port, controller.signal, (value) => updateRun(run.sessionId, value), onEvent);
  }
  function selectSession(id: string) {
    if (!abort.current) {
      store.setActiveId(id);
      setSelectedRunId('');
      setStream('');
    }
  }
  function newSession() {
    if (abort.current) return;
    const value = createSession(profiles[0]?.id ?? 'codex-native');
    changeSession(value);
    selectSession(value.id);
    setError(null);
  }
  async function send(text: string, invoke: boolean, profileId: string): Promise<boolean> {
    if (abort.current || !text.trim()) return false;
    let accepted = false;
    await perform(async (controller) => {
      const current = session ?? createSession(profileId);
      if (current.activeTurnId) throw new Error('previous_turn_active');
      const profile = profiles.find((item) => item.id === profileId);
      const command = workflowCommand(text, saved?.definition.id);
      const value: ConversationSession = {
        ...current,
        profileId,
        title: current.title || text.slice(0, 32),
        messages: [...current.messages, message('user', text)],
      };
      if (!profile) throw new Error('profile_missing');
      if (invoke || command.invoke) {
        if (!saved) throw new Error('workflow_not_saved');
        if (current.runs.some((run) => ['ready', 'running', 'awaiting_review'].includes(run.status)))
          throw new Error('run_in_progress');
        const run = createRun(saved, value.id, command.spec, profiles, profileId);
        value.runs = [...value.runs, run];
        setSelectedRunId(run.id);
        changeSession(value);
        store.setActiveId(value.id);
        accepted = true;
        await drive(run, controller);
      } else {
        const request = chatRequest(value, profile);
        value.activeTurnId = request.turnId;
        changeSession(value);
        store.setActiveId(value.id);
        accepted = true;
        const result = await port.send(request, onEvent, controller.signal);
        const reply = {
          ...message('assistant', result.text),
          status: result.status === 'completed' ? ('complete' as const) : ('failed' as const),
          errorCode: result.errorCode ?? undefined,
          nativeSessionId: result.nativeSessionId ?? undefined,
        };
        const settled = { ...value, messages: [...value.messages, reply] };
        delete settled.activeTurnId;
        changeSession(settled);
      }
    });
    return accepted;
  }
  async function approve(run: WorkflowRun, nodeId: string, hash: string) {
    await perform(async (controller) => {
      await drive(await approveRun(run, nodeId, hash), controller);
    });
  }
  async function retry(run: WorkflowRun) {
    await perform(async (controller) => {
      if (
        session?.runs.some(
          (other) => other.id !== run.id && ['ready', 'running', 'awaiting_review'].includes(other.status),
        )
      )
        throw new Error('run_in_progress');
      const previous = run.plan
        .map((node) => run.steps[node.id])
        .find((step) => ['failed', 'interrupted'].includes(step.status));
      if (previous?.turnId) await port.cancel(previous.turnId);
      await drive(retryRun(run), controller);
    });
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
  function cancel(run?: WorkflowRun) {
    if (abort.current) {
      abort.current.abort();
      return;
    }
    if (run && run.status === 'awaiting_review') updateRun(run.sessionId, { ...run, status: 'cancelled' });
  }
  return {
    ...store,
    setActiveId: selectSession,
    busy,
    stream,
    send,
    newSession,
    approve,
    retry,
    cancel,
    stopRecovered,
    selectedRunId,
    setSelectedRunId,
  };
}

export type Conversations = ReturnType<typeof useConversations>;
