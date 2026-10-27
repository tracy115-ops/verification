import { useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  ReactFlow,
  useNodesState,
  type Connection,
  type Edge,
} from '@xyflow/react';
import { Bot, Layers3, Plus, ShieldCheck } from 'lucide-react';
import { addDependency, addReview } from '../../domain/document';
import type { WorkbenchDocument } from '../../domain/workflow';
import { isMessageKey, useI18n } from '../../shared/i18n/context';
import type { MessageKey } from '../../shared/i18n/messages';
import { WorkflowCard, type WorkflowCanvasNode } from './WorkflowCard';
import { NodeInspector } from './NodeInspector';
import { kindKeys, nodeLabel } from './node-label';
import { WorkflowMetadata } from './WorkflowMetadata';
import { formatCount } from '../../shared/i18n/count';

const nodeTypes = { workflow: WorkflowCard };
interface Props {
  document: WorkbenchDocument;
  selectedId: string;
  selectNode: (id: string) => void;
  update: (next: WorkbenchDocument) => void;
  notify: (key: MessageKey) => void;
  openWorkspace: (nodeId: string) => void;
  openAgents: () => void;
}

export function WorkflowEditor({
  document,
  selectedId,
  selectNode,
  update,
  notify,
  openWorkspace,
  openAgents,
}: Props) {
  const { t, locale } = useI18n();
  const derivedNodes = useMemo<WorkflowCanvasNode[]>(
    () =>
      document.definition.nodes.map((node, index) => {
        const profile = document.profiles.find((item) => item.id === document.bindings[node.id]);
        return {
          id: node.id,
          type: 'workflow',
          position: document.layout[node.id] ?? { x: 80, y: index * 130 },
          selected: node.id === selectedId,
          data: {
            label: nodeLabel(node, document, t),
            kind: node.kind,
            kindLabel: t(kindKeys[node.kind]),
            profile: node.role ? (profile?.driver ?? t('inherit')) : t('noAgent'),
          },
        };
      }),
    [document, selectedId, t],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(derivedNodes);
  useEffect(() => setNodes(derivedNodes), [derivedNodes, setNodes]);
  const edges: Edge[] = document.definition.nodes.flatMap((node) =>
    node.dependsOn.map((source) => ({
      id: JSON.stringify([source, node.id]),
      source,
      target: node.id,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    })),
  );
  const selected =
    document.definition.nodes.find((node) => node.id === selectedId) ?? document.definition.nodes[0];
  function connect(connection: Connection) {
    try {
      update(addDependency(document, connection.source, connection.target));
    } catch (error) {
      notify(error instanceof Error && isMessageKey(error.message) ? error.message : 'invalidDocument');
    }
  }
  function appendReview() {
    try {
      const next = addReview(document, selected.id);
      update(next);
      selectNode(next.definition.nodes.at(-1)?.id ?? selected.id);
    } catch {
      notify('invalidDocument');
    }
  }
  return (
    <div className="workflow-shell">
      <section className="workflow-canvas-region">
        <WorkflowMetadata document={document} update={update} />
        <div className="workflow-summary">
          <span>
            <Layers3 size={15} />
            {formatCount(locale, 'nodes', document.definition.nodes.length)}
          </span>
          <span>
            <Bot size={15} />
            {formatCount(locale, 'agents', document.definition.nodes.filter((node) => node.role).length)}
          </span>
          <span>
            <ShieldCheck size={15} />
            {formatCount(
              locale,
              'reviews',
              document.definition.nodes.filter((node) => node.kind === 'human').length,
            )}
          </span>
          <button className="workbench-btn wb-small" onClick={appendReview}>
            <Plus size={14} />
            {t('addReview')}
          </button>
        </div>
        <div className="workflow-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={(_, node) => selectNode(node.id)}
            onConnect={connect}
            onNodeDragStop={(_, node) =>
              update({ ...document, layout: { ...document.layout, [node.id]: node.position } })
            }
            defaultViewport={{ x: 38, y: 28, zoom: 0.9 }}
            minZoom={0.35}
            maxZoom={1.5}
            deleteKeyCode={null}
            nodesConnectable
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
        <div className="workflow-canvas-note">{t('connecting')}</div>
      </section>
      <NodeInspector
        key={selected.id}
        document={document}
        node={selected}
        update={update}
        openWorkspace={() => openWorkspace(selected.id)}
        openAgents={openAgents}
      />
    </div>
  );
}
