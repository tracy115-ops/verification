import { Bot, CheckCheck, GitBranch, Play, Workflow } from 'lucide-react';
import type { ComponentType } from 'react';
import type { MessageKey } from '../shared/i18n/messages';

export type Page = 'workflow' | 'assets' | 'cases' | 'runs' | 'agents';
export const navigation: { page: Page; icon: ComponentType<{ size?: number }>; key: MessageKey }[] = [
  { page: 'workflow', icon: Workflow, key: 'workflow' },
  { page: 'runs', icon: Play, key: 'runs' },
  { page: 'assets', icon: GitBranch, key: 'assets' },
  { page: 'cases', icon: CheckCheck, key: 'cases' },
  { page: 'agents', icon: Bot, key: 'agents' },
];

export function workspacePage(nodeId: string): Page {
  if (['review_cases', 'generate_cases'].includes(nodeId)) return 'cases';
  if (
    [
      'execute_tests',
      'analyze_verdict',
      'dispatch_actions',
      'implement_tests',
      'preflight',
      'review_execution',
    ].includes(nodeId)
  )
    return 'runs';
  return 'assets';
}
