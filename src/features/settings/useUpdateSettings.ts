import { useEffect, useRef, useState } from 'react';
import { version } from '../../../package.json';
import { hasDesktopBridge } from '../../services/agent-api';
import * as api from '../../services/system-api';
import { installWithRecovery } from '../../services/update-preparation';

type Busy = 'check' | 'download' | 'backup' | 'install' | null;
export function useUpdateSettings(blocked: boolean) {
  const [status, setStatus] = useState<api.UpdateStatus>({
    currentVersion: version,
    supported: false,
    release: null,
    ready: false,
  });
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState('');
  const [backupFailed, setBackupFailed] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState<api.UpdateProgress>({ downloaded: 0, total: 1 });
  const active = useRef(true);
  const allowed = useRef(!blocked);
  allowed.current = !blocked;
  const running = useRef(false);
  const preparation = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    if (hasDesktopBridge())
      void api
        .updateStatus()
        .then((value) => {
          if (active.current) setStatus(value);
        })
        .catch(() => {});
    return () => {
      active.current = false;
      preparation.current?.abort();
      void api.cancelUpdate().catch(() => {});
    };
  }, []);
  function cancel() {
    if (preparation.current) setCancelled(true);
    preparation.current?.abort();
    setConfirm(false);
    void api.cancelUpdate().catch(() => {});
  }
  async function perform(kind: 'check' | 'download' | 'install') {
    if (running.current || (kind === 'install' && !allowed.current)) return;
    running.current = true;
    setError('');
    setBackupFailed(false);
    setCancelled(false);
    setBusy(kind === 'install' ? 'backup' : kind);
    if (kind !== 'install') setConfirm(false);
    let stage: Busy = kind === 'install' ? 'backup' : kind;
    try {
      if (kind === 'install') {
        const controller = new AbortController();
        preparation.current = controller;
        await installWithRecovery(
          controller.signal,
          () => active.current && allowed.current,
          (value) => {
            stage = value;
            if (active.current) setBusy(value);
          },
        );
        if (active.current) setConfirm(false);
      } else {
        const value =
          kind === 'check'
            ? await api.checkUpdate()
            : await api.downloadUpdate((value) => {
                if (active.current) setProgress(value);
              });
        if (active.current) {
          setStatus(value);
          setChecked(true);
        }
      }
    } catch (error) {
      if (active.current) {
        setConfirm(false);
        const code =
          typeof error === 'string'
            ? error
            : error instanceof Error
              ? error.message
              : 'update_network_failed';
        const stopped = stage === 'backup' && code === 'update_cancelled';
        setBackupFailed(stage === 'backup' && !stopped);
        setError(stopped ? '' : code);
      }
      if (kind === 'install')
        void api
          .updateStatus()
          .then((value) => {
            if (active.current) setStatus(value);
          })
          .catch(() => {});
    } finally {
      preparation.current = null;
      running.current = false;
      if (active.current) setBusy(null);
    }
  }
  return {
    status,
    busy,
    error,
    backupFailed,
    cancelled,
    checked,
    confirm,
    progress,
    setConfirm,
    perform,
    cancel,
  };
}
