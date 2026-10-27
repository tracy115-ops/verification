import type { NodeKind } from './workflow';

export const operationKinds = new Map<string, NodeKind>([
  ['documents.import', 'import'],
  ['requirements.extract', 'agent'],
  ['review.requirements', 'human'],
  ['scenarios.design', 'agent'],
  ['review.coverage', 'human'],
  ['cases.generate', 'agent'],
  ['review.cases', 'human'],
  ['tests.implement', 'agent'],
  ['targets.preflight', 'validation'],
  ['review.execution', 'human'],
  ['targets.execute', 'runner'],
  ['verdicts.evaluate', 'evaluation'],
  ['actions.dispatch', 'policy'],
  ['review.custom', 'human'],
]);
