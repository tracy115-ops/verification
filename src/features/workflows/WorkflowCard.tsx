import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Bot, CheckCheck, FileInput, Play, ScanEye, ShieldCheck, Workflow } from 'lucide-react';
import type { NodeKind } from '../../domain/workflow';
import { useI18n } from '../../shared/i18n/context';

export type WorkflowCanvasNode = Node<
  { label: string; kind: NodeKind; kindLabel: string; profile: string },
  'workflow'
>;
const icons = {
  import: FileInput,
  agent: Bot,
  human: ShieldCheck,
  validation: CheckCheck,
  runner: Play,
  evaluation: ScanEye,
  policy: Workflow,
};

export function WorkflowCard({ data, selected }: NodeProps<WorkflowCanvasNode>) {
  const { t } = useI18n();
  const Icon = icons[data.kind];
  return (
    <div className={`workflow-node ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Top} aria-label={t('portIn')} />
      <div className="workflow-node-heading">
        <span className={`workflow-node-icon kind-${data.kind}`}>
          <Icon size={17} />
        </span>
        <span>
          <small>{data.kindLabel}</small>
          <strong>{data.label}</strong>
        </span>
      </div>
      <div className="workflow-node-meta">
        <span className="workflow-node-dot" />
        {data.profile}
      </div>
      <Handle type="source" position={Position.Bottom} aria-label={t('portOut')} />
    </div>
  );
}
