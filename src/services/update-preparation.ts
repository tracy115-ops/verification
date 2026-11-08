import { createPersonalShadow } from './personal-shadow';
import { installUpdate } from './system-api';

export async function installWithRecovery(
  signal: AbortSignal,
  mayContinue: () => boolean,
  stage: (value: 'backup' | 'install') => void,
) {
  if (signal.aborted) throw new Error('update_cancelled');
  stage('backup');
  const result = await createPersonalShadow();
  if (signal.aborted) throw new Error('update_cancelled');
  if (!mayContinue()) throw new Error('update_tasks_running');
  const latest = result.snapshots[0];
  if (!latest) throw new Error('update_backup_required');
  stage('install');
  await installUpdate({ id: latest.id, sha256: latest.sha256 });
}
