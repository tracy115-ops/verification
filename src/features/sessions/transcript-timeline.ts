import type { CliTurnRecord } from '../../domain/runtime/transcript';
import type { ConversationMessage, ConversationSession, WorkflowRun } from '../../domain/runtime/types';

export type TimelineEntry =
  | { id: string; at: string; kind: 'message'; message: ConversationMessage }
  | { id: string; at: string; kind: 'turn'; turn: CliTurnRecord; run: WorkflowRun }
  | { id: string; at: string; kind: 'approval'; run: WorkflowRun; nodeId: string }
  | {
      id: string;
      at: string;
      kind: 'clarifications' | 'exclusions';
      run: WorkflowRun;
      items: { question: string; answer: string }[];
    }
  | { id: string; at: string; kind: 'revision'; run: WorkflowRun; artifactKey: string };

export function transcriptTimeline(session: ConversationSession, turns: CliTurnRecord[]): TimelineEntry[] {
  const entries: TimelineEntry[] = session.messages.map((message) => ({
    id: message.id,
    at: message.createdAt,
    kind: 'message',
    message,
  }));
  for (const turn of turns) {
    const run = session.runs.find((item) => item.id === turn.runId);
    if (run) entries.push({ id: turn.id, at: turn.startedAt, kind: 'turn', turn, run });
  }
  for (const run of session.runs) {
    for (const approval of run.approvals)
      entries.push({
        id: `${run.id}:approval:${approval.nodeId}:${approval.digest}`,
        at: approval.approvedAt,
        kind: 'approval',
        run,
        nodeId: approval.nodeId,
      });
    const decisions = new Map<string, Extract<TimelineEntry, { kind: 'clarifications' | 'exclusions' }>>();
    for (const item of run.clarifications ?? []) {
      const id = `${run.id}:clarifications:${item.recordedAt.slice(0, 19)}`;
      const group = decisions.get(id) ?? { id, at: item.recordedAt, kind: 'clarifications', run, items: [] };
      group.items.push({ question: item.question, answer: item.answer });
      decisions.set(id, group);
    }
    for (const item of run.reviewExclusions ?? []) {
      const id = `${run.id}:exclusions:${item.nodeId}:${item.recordedAt.slice(0, 19)}`;
      const group = decisions.get(id) ?? { id, at: item.recordedAt, kind: 'exclusions', run, items: [] };
      group.items.push({ question: item.issue, answer: item.reason });
      decisions.set(id, group);
    }
    entries.push(...decisions.values());
    for (const [key, artifact] of Object.entries(run.artifacts)) {
      const value = artifact.value;
      const at =
        value && typeof value === 'object'
          ? 'recordedAt' in value
            ? value.recordedAt
            : 'at' in value
              ? value.at
              : undefined
          : undefined;
      if (
        ['ImplementationRevision', 'DesignRevision', 'CaseRevision'].includes(artifact.type) &&
        value &&
        typeof value === 'object' &&
        typeof at === 'string' &&
        Number.isFinite(Date.parse(at))
      )
        entries.push({
          id: `${run.id}:${key}`,
          at,
          kind: 'revision',
          run,
          artifactKey: key,
        });
    }
  }
  const priority = (entry: TimelineEntry) =>
    entry.kind === 'message' && entry.message.role === 'user' ? 0 : entry.kind === 'turn' ? 1 : 2;
  return entries.sort(
    (a, b) => a.at.localeCompare(b.at) || priority(a) - priority(b) || a.id.localeCompare(b.id),
  );
}
