import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { FrameworkProfile } from '../../domain/execution/types';
import {
  getFrameworkInspection,
  inspectFramework,
  subscribeFrameworkInspections,
} from '../../services/framework-inspection-api';

export function useFrameworkInspection(value: FrameworkProfile, disabled: boolean) {
  const record = useSyncExternalStore(subscribeFrameworkInspections, () => getFrameworkInspection(value));
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    generation.current++;
    setBusy(false);
    setStopping(false);
    setError('');
    return () => {
      generation.current++;
      controller.current?.abort();
      controller.current = null;
    };
  }, [value.pythonCommand, value.frameworkSource, disabled]);
  async function run() {
    if (busy || disabled) return;
    const token = ++generation.current;
    const next = new AbortController();
    controller.current = next;
    setBusy(true);
    setStopping(false);
    setError('');
    try {
      await inspectFramework(value, next.signal);
    } catch (cause) {
      if (generation.current === token)
        setError(cause instanceof Error ? cause.message : 'framework_inspection_failed');
    } finally {
      if (generation.current === token) {
        setBusy(false);
        setStopping(false);
        controller.current = null;
      }
    }
  }
  return {
    record,
    busy,
    stopping,
    error,
    run,
    cancel() {
      setStopping(true);
      controller.current?.abort();
    },
  };
}
