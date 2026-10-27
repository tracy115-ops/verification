import { ArrowUpRight, Bot, Clock, Fingerprint, ShieldCheck } from 'lucide-react';
import type { WorkbenchDocument, WorkflowNode } from '../../domain/workflow';
import { useI18n } from '../../shared/i18n/context';
import { Status } from '../../shared/components/Status';
import { kindKeys, nodeLabel } from './node-label';

interface Props {
  document: WorkbenchDocument;
  node: WorkflowNode;
  update: (next: WorkbenchDocument) => void;
  openWorkspace: () => void;
  openAgents: () => void;
}

export function NodeInspector({ document, node, update, openWorkspace, openAgents }: Props) {
  const { t } = useI18n();
  const profile = document.profiles.find((item) => item.id === document.bindings[node.id]);
  function patchNode(patch: Partial<WorkflowNode>) {
    update({
      ...document,
      definition: {
        ...document.definition,
        nodes: document.definition.nodes.map((item) => (item.id === node.id ? { ...item, ...patch } : item)),
      },
    });
  }
  return (
    <aside className="workflow-inspector" aria-label={t('nodeSettings')}>
      <div className="wb-panel-heading">
        <h2>{t('nodeSettings')}</h2>
        <Status tone="accent">{t(kindKeys[node.kind])}</Status>
      </div>
      <div className="workflow-inspector-body">
        <label className="wb-field">
          {t('name')}
          <input
            className="workbench-input"
            value={nodeLabel(node, document, t)}
            onChange={(event) =>
              update({ ...document, nodeTitles: { ...document.nodeTitles, [node.id]: event.target.value } })
            }
          />
        </label>
        <div className="wb-label">
          <Fingerprint size={14} />
          {t('nodeId')}
        </div>
        <code className="wb-code">{node.id}</code>
        <hr />
        <h3>
          <Bot size={16} />
          {t('driver')}
        </h3>
        {node.role ? (
          <>
            <div className="wb-definition">
              <span>{t('role')}</span>
              <code>{node.role}</code>
            </div>
            <label className="wb-field">
              {t('profile')}
              <select
                className="workbench-select"
                value={document.bindings[node.id] ?? ''}
                onChange={(event) => {
                  const bindings = { ...document.bindings };
                  if (event.target.value) bindings[node.id] = event.target.value;
                  else delete bindings[node.id];
                  update({ ...document, bindings });
                }}
              >
                <option value="">{t('inherit')}</option>
                {document.profiles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            {profile && (
              <div className="workflow-profile-summary">
                <strong>{profile.driver}</strong>
                <span>{profile.protocol === 'native' ? t('native') : profile.protocol}</span>
                <Status tone="warning">{t('notProbed')}</Status>
              </div>
            )}
            <p className="wb-muted">{t('agentHint')}</p>
            <button className="workbench-btn wb-full" onClick={openAgents}>
              {t('agents')}
              <ArrowUpRight size={14} />
            </button>
          </>
        ) : (
          <div className="wb-empty-note">
            <ShieldCheck size={18} />
            <span>
              {t('noAgent')}
              <small>{t('systemNode')}</small>
            </span>
          </div>
        )}
        <hr />
        <label className="wb-field">
          <span>
            <Clock size={14} /> {t('timeout')}
          </span>
          <input
            className="workbench-input"
            type="number"
            min={1}
            max={86400}
            value={node.policy.timeoutSeconds}
            onChange={(event) =>
              patchNode({ policy: { ...node.policy, timeoutSeconds: Number(event.target.value) } })
            }
          />
        </label>
        <details className="workflow-contract">
          <summary>{t('details')}</summary>
          <h3>{t('inputs')}</h3>
          {Object.values(node.inputs).map((input) => (
            <code key={input.from}>
              {input.from} → {input.type}
            </code>
          ))}
          {!Object.keys(node.inputs).length && <p>{t('noInputs')}</p>}
          <h3>{t('outputs')}</h3>
          {Object.entries(node.outputs).map(([slot, type]) => (
            <code key={slot}>
              {slot} → {type}
            </code>
          ))}
          <h3>{t('tools')}</h3>
          {node.requiresCapabilities.map((capability) => (
            <code key={capability}>{capability}</code>
          ))}
        </details>
        <button className="workbench-btn wb-primary wb-full" onClick={openWorkspace}>
          {t('openWorkspace')}
          <ArrowUpRight size={15} />
        </button>
      </div>
    </aside>
  );
}
