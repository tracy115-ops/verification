import type { WorkflowRun } from '../../domain/runtime/types';

export interface CaseEditorTarget {
  sessionId: string;
  runId: string;
  id: string;
  sourceId?: string;
  mode: 'add' | 'edit' | 'copy';
}
export type OpenCaseEditor = (
  run: WorkflowRun,
  sourceId: string | undefined,
  mode: CaseEditorTarget['mode'],
) => void;
export type CaseFocus = Pick<CaseEditorTarget, 'sessionId' | 'runId' | 'id'>;
export interface CaseFormValue {
  target: CaseEditorTarget;
  baseline: string;
  id: string;
  title: string;
  scenarioIds: string[];
  requirementIds: string[];
  preconditions: string;
  steps: string;
  expected: string;
  assertions: string;
  reason: string;
}
