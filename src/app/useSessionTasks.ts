import { useEffect, useRef, useState } from 'react';
import type { AgentEvent } from '../domain/runtime/types';

export function useSessionTasks(activeId: string) {
  const controllers = useRef(new Map<string, AbortController>());
  const [running, setRunning] = useState<string[]>([]);
  const [streams, setStreams] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  useEffect(
    () => () => {
      for (const controller of controllers.current.values()) controller.abort();
    },
    [],
  );
  async function perform(task: (controller: AbortController) => Promise<void>, id = activeId) {
    if (controllers.current.has(id)) return;
    const controller = new AbortController();
    controllers.current.set(id, controller);
    setRunning([...controllers.current.keys()]);
    setStreams((value) => ({ ...value, [id]: '' }));
    setErrors((value) => ({ ...value, [id]: null }));
    try {
      await task(controller);
    } catch (error) {
      setErrors((value) => ({
        ...value,
        [id]: error instanceof Error ? error.message : typeof error === 'string' ? error : 'cli_failed',
      }));
    } finally {
      controllers.current.delete(id);
      setRunning([...controllers.current.keys()]);
      setStreams((value) => ({ ...value, [id]: '' }));
    }
  }
  function onEvent(id: string, event: AgentEvent) {
    if (event.type === 'text' && event.text)
      setStreams((value) => ({ ...value, [id]: (value[id] ?? '') + event.text }));
  }
  return {
    perform,
    onEvent,
    busy: running.includes(activeId),
    anyBusy: running.length > 0,
    stream: streams[activeId] ?? '',
    error: errors[activeId],
    isSessionBusy: (id: string) => controllers.current.has(id),
    cancel: (id = activeId) => controllers.current.get(id)?.abort(),
  };
}
