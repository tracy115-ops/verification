/** Safe transport counters; none certify that the model has received a request. */
export interface CliProgress {
  elapsedMs: number;
  inputWritten: boolean;
  lastOutputAgeMs: number | null;
  protocolRecords: number;
  publicTextBytes: number;
}

export function isCliProgress(value: unknown): value is CliProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
  return (
    Object.keys(item).length === 5 &&
    count(item.elapsedMs) &&
    typeof item.inputWritten === 'boolean' &&
    (item.lastOutputAgeMs === null || count(item.lastOutputAgeMs)) &&
    count(item.protocolRecords) &&
    count(item.publicTextBytes)
  );
}

export function progressPhase(progress: CliProgress) {
  if (progress.publicTextBytes > 0) return 'cliProgressReply';
  if (progress.protocolRecords > 0) return 'cliProgressStatus';
  return progress.inputWritten ? 'cliProgressWritten' : 'cliProgressStarting';
}
