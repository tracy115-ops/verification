import type { AgentProfile, DriverId, WorkbenchDocument, WorkflowNode } from '../workflow';
import type { FrameworkProfile } from '../execution/types';

export interface AgentEvent {
  type: 'text' | 'activity' | 'session' | 'heartbeat';
  text?: string;
  name?: string;
  id?: string;
}
export interface TurnRequest {
  turnId: string;
  sessionId: string;
  driver: DriverId;
  prompt: string;
  model: string;
  timeoutSeconds: number;
}
export interface TurnOutcome {
  status: 'completed' | 'failed' | 'cancelled' | 'timed_out';
  text: string;
  errorCode: string | null;
  nativeSessionId: string | null;
}
export interface AgentPort {
  send(request: TurnRequest, onEvent: (event: AgentEvent) => void, signal: AbortSignal): Promise<TurnOutcome>;
  cancel(turnId: string): Promise<void>;
}
export interface Artifact {
  type: string;
  value: unknown;
  digest: string;
}
export type StepStatus = 'pending' | 'running' | 'awaiting_review' | 'succeeded' | 'failed' | 'interrupted';
export interface StepState {
  status: StepStatus;
  attempts: number;
  turnId?: string;
  executionId?: string;
  nativeSessionId?: string;
  reviewDigest?: string;
  caseBatches?: { signature: string; index: number; cases: CaseArtifact }[];
  errorCode?: string;
}
export interface WorkflowRun {
  id: string;
  sessionId: string;
  createdAt: string;
  scope: 'design' | 'verification';
  executionProfile?: FrameworkProfile;
  snapshot: WorkbenchDocument;
  plan: WorkflowNode[];
  profiles: AgentProfile[];
  defaultProfileId: string;
  spec: string;
  status: 'ready' | 'running' | 'awaiting_review' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  steps: Record<string, StepState>;
  artifacts: Record<string, Artifact>;
  approvals: { nodeId: string; digest: string; approvedAt: string }[];
  clarifications?: { question: string; answer: string; recordedAt: string }[];
  reviewExclusions?: { nodeId: string; issue: string; reason: string; recordedAt: string }[];
  errorCode?: string;
}
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  status: 'complete' | 'failed' | 'interrupted';
  errorCode?: string;
  nativeSessionId?: string;
}
export interface ConversationSession {
  id: string;
  title: string;
  profileId: string;
  messages: ConversationMessage[];
  runs: WorkflowRun[];
  activeTurnId?: string;
}

export interface RequirementArtifact {
  requirements: { id: string; text: string; quote: string; acceptanceCriteria: string[] }[];
  questions: string[];
}
export interface DesignArtifact {
  strategy: string;
  factors?: { id: string; name: string; requirementIds: string[]; levels: string[]; sourceQuote: string }[];
  scenarios: {
    id: string;
    title: string;
    requirementIds: string[];
    dimension: string;
    expected: string;
    factorLevels?: { factorId: string; level: string }[];
  }[];
  gaps: string[];
}
export interface CaseArtifact {
  cases: {
    id: string;
    title: string;
    scenarioIds: string[];
    requirementIds: string[];
    preconditions: string[];
    steps: string[];
    expected: string;
    assertions: string[];
  }[];
}
