import type { WorkbenchDocument, WorkflowNode } from '../../domain/workflow';
import { isMessageKey } from '../../shared/i18n/context';
import type { MessageKey } from '../../shared/i18n/messages';

export const kindKeys: Record<WorkflowNode['kind'], MessageKey> = {
  import: 'typeImport',
  agent: 'typeAgent',
  human: 'typeHuman',
  validation: 'typeValidation',
  runner: 'typeRunner',
  evaluation: 'typeEvaluation',
  policy: 'typePolicy',
};

export function nodeLabel(
  node: WorkflowNode,
  document: WorkbenchDocument,
  t: (key: MessageKey) => string,
): string {
  return document.nodeTitles[node.id] || (isMessageKey(node.id) ? t(node.id) : t('customReview'));
}
