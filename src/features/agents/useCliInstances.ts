import { useState } from 'react';
import type { DriverId } from '../../domain/workflow';
import { discoverCliInstances, pickCliPath, type CliInstance } from '../../services/cli-instances';
import type { MessageKey } from '../../shared/i18n/messages';

export function useCliInstances(driver: DriverId) {
  const [instances, setInstances] = useState<CliInstance[]>([]);
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<MessageKey>();
  async function scan() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      setInstances((await discoverCliInstances()).filter((item) => item.driver === driver));
      setScanned(true);
    } catch {
      setError('discoveryFailed');
    } finally {
      setBusy(false);
    }
  }
  async function browse(kind: 'executable' | 'configuration', accept: (path: string) => void) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const path = await pickCliPath(kind);
      if (path) accept(path);
    } catch {
      setError('cliPickerFailed');
    } finally {
      setBusy(false);
    }
  }
  return { instances, busy, scanned, error, scan, browse };
}
