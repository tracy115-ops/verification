export type TeamRole = 'admin' | 'editor' | 'reviewer' | 'viewer';
export interface TeamMember {
  id: string;
  name: string;
  role: TeamRole;
}
export interface ExternalInterface {
  id: string;
  name: string;
  contract: string;
}
export interface TestFactor {
  id: string;
  name: string;
  levels: string[];
  basis: 'explicit' | 'hypothesis';
  sourceQuote: string;
  rationale: string;
}
export interface FactorValue {
  factorId: string;
  level: string;
}
export interface ScenarioReview {
  decision: 'accepted' | 'needs_changes';
  by: string;
  at: string;
  comment: string;
}
export interface TeamScenario {
  id: string;
  title: string;
  interfaceIds: string[];
  factorValues: FactorValue[];
  oracle: string;
  oracleBasis: 'unknown' | 'contract' | 'approved_assumption';
  sourceQuote: string;
  ownerId: string;
  review?: ScenarioReview;
}
export interface TeamAnalysis {
  factors: TestFactor[];
  scenarios: TeamScenario[];
  questions: string[];
}
export interface TeamProject extends TeamAnalysis {
  formatVersion: 1;
  id: string;
  title: string;
  mode: 'black_box' | 'collaborative';
  locale: 'zh-CN' | 'en-US';
  topic: string;
  interfaces: ExternalInterface[];
  revision: number;
  updatedAt: string;
  updatedBy: string;
  comments: { id: string; scenarioId: string; text: string; by: string; at: string }[];
}
export type ProjectInput = Pick<TeamProject, 'title' | 'mode' | 'locale' | 'topic' | 'interfaces'>;
export type TeamCommand =
  | { type: 'suggest' }
  | { type: 'replace_analysis'; analysis: TeamAnalysis }
  | { type: 'upsert_factor'; factor: TestFactor }
  | { type: 'add_scenario'; id: string; title: string; interfaceIds: string[] }
  | {
      type: 'edit_scenario';
      scenarioId: string;
      title: string;
      oracle: string;
      oracleBasis: TeamScenario['oracleBasis'];
      sourceQuote: string;
      factorValues: FactorValue[];
      ownerId: string;
    }
  | { type: 'review'; scenarioId: string; decision: 'accepted' | 'needs_changes'; comment: string }
  | { type: 'comment'; scenarioId: string; text: string };
export interface ProjectSummary {
  id: string;
  title: string;
  mode: TeamProject['mode'];
  revision: number;
  updatedAt: string;
}
export interface TeamHistory {
  revision: number;
  action: string;
  actor: string;
  at: string;
}
