import type { AgentEvent, TurnOutcome, TurnRequest } from './types';
import { isCliProgress, type CliProgress } from './cli-progress';

export interface CliTurnRecord {
  version: 1;
  id: string;
  sessionId: string;
  runId?: string;
  nodeId?: string;
  operation: string;
  request: TurnRequest;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'interrupted' | TurnOutcome['status'];
  text: string;
  activities: { name: string; at: string }[];
  errorCode?: string;
  validationError?: string;
  progress?: CliProgress;
}

export interface TranscriptRepository {
  readSession(sessionId: string): Promise<CliTurnRecord[]>;
  save(record: CliTurnRecord): Promise<void>;
  removeSession(sessionId: string): Promise<void>;
}

export function isCliTurnRecord(value: unknown): value is CliTurnRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CliTurnRecord>;
  const request = item.request;
  return (
    item.version === 1 &&
    typeof item.id === 'string' &&
    typeof item.sessionId === 'string' &&
    (item.runId === undefined || typeof item.runId === 'string') &&
    (item.nodeId === undefined || typeof item.nodeId === 'string') &&
    typeof item.operation === 'string' &&
    typeof item.startedAt === 'string' &&
    Number.isFinite(Date.parse(item.startedAt)) &&
    (item.finishedAt === undefined ||
      (typeof item.finishedAt === 'string' && Number.isFinite(Date.parse(item.finishedAt)))) &&
    ['running', 'interrupted', 'completed', 'failed', 'cancelled', 'timed_out'].includes(
      String(item.status),
    ) &&
    typeof item.text === 'string' &&
    item.text.length <= 2097152 &&
    !!request &&
    typeof request === 'object' &&
    !Array.isArray(request) &&
    request.turnId === item.id &&
    request.sessionId === item.sessionId &&
    ['codex', 'claude', 'pi', 'codeagent'].includes(String(request.driver)) &&
    typeof request.model === 'string' &&
    request.model.length <= 200 &&
    typeof request.prompt === 'string' &&
    new TextEncoder().encode(request.prompt).length <= 131072 &&
    Number.isInteger(request.timeoutSeconds) &&
    request.timeoutSeconds > 0 &&
    request.timeoutSeconds <= 86400 &&
    (item.errorCode === undefined || typeof item.errorCode === 'string') &&
    (item.validationError === undefined || typeof item.validationError === 'string') &&
    (item.progress === undefined || isCliProgress(item.progress)) &&
    Array.isArray(item.activities) &&
    item.activities.length <= 100 &&
    item.activities.every(
      (event) =>
        !!event &&
        typeof event === 'object' &&
        typeof event.at === 'string' &&
        typeof event.name === 'string' &&
        event.name.length <= 160 &&
        Number.isFinite(Date.parse(event.at)),
    )
  );
}

export function recordActivity(record: CliTurnRecord, event: AgentEvent) {
  if (event.type === 'progress' && isCliProgress(event.progress)) record.progress = { ...event.progress };
  if (event.type === 'text' && event.text) record.text = (record.text + event.text).slice(0, 2097152);
  if (event.type === 'activity' && event.name && record.activities.length < 100)
    record.activities.push({ name: event.name.slice(0, 160), at: new Date().toISOString() });
}
