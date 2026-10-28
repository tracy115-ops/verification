import { useEffect, useRef, useState } from 'react';
import { hasDesktopBridge } from '../../services/agent-api';
import { lanApi, type LanHost } from '../../services/lan-api';
import type { MessageKey } from '../../shared/i18n/messages';

export function useLanHost(notify: (key: MessageKey) => void) {
  const native = hasDesktopBridge();
  const [host, setHost] = useState<LanHost | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(native);
  const [error, setError] = useState<string | null>(null);
  const changing = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    if (!native) return;
    let alive = true;
    async function refresh() {
      if (changing.current) return;
      const started = generation.current;
      try {
        const info = await lanApi.status();
        if (alive && !changing.current && started === generation.current) setHost(info);
      } catch {
        if (alive) setError('lan_status_failed');
      } finally {
        if (alive) setChecking(false);
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [native]);
  async function perform(task: () => Promise<void>) {
    if (changing.current) return;
    generation.current++;
    changing.current = true;
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      changing.current = false;
      setBusy(false);
    }
  }
  return {
    native,
    host,
    busy: busy || checking,
    checking,
    error,
    perform,
    start: (port: number, name: string) =>
      perform(async () => {
        setHost(await lanApi.start(port, name));
        notify('lan_started');
      }),
    stop: () =>
      perform(async () => {
        await lanApi.stop();
        setHost(null);
        notify('lan_stopped');
      }),
    copy: (value: string) =>
      perform(async () => {
        await navigator.clipboard.writeText(value);
        notify('lan_copied');
      }),
  };
}
