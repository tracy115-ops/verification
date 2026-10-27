import { GitBranch, MessageSquare, Play, Workflow } from 'lucide-react';
import type { ComponentType } from 'react';
import type { MessageKey } from '../shared/i18n/messages';

export type Page = 'sessions' | 'workflow' | 'assets' | 'cases' | 'runs' | 'settings';
export const navigation: { page: Page; icon: ComponentType<{ size?: number }>; key: MessageKey }[] = [
  { page: 'sessions', icon: MessageSquare, key: 'sessions' },
  { page: 'workflow', icon: Workflow, key: 'workflow' },
  { page: 'runs', icon: Play, key: 'runs' },
  { page: 'assets', icon: GitBranch, key: 'assetsTitle' },
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
