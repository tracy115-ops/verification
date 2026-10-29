import { useEffect, useRef } from 'react';
import type { Artifact, WorkflowRun } from '../../domain/runtime/types';
import { isCases, isDesign, isRequirements } from '../../domain/runtime/artifacts';
import { isEvidence, isExecutionPlan, isImplementation, isVerdict } from '../../domain/execution/schema';
import { useI18n } from '../../shared/i18n/context';
import { nodeLabel } from '../workflows/node-label';
import { artifactLabel } from './artifact-labels';
import { ArtifactCollection } from './ArtifactCollection';
import { ArtifactPanel } from './ArtifactPanel';
import { EvidenceViewer } from './EvidenceViewer';
import { ExecutionArtifact } from './ExecutionArtifact';
import type { UpdateRun } from '../reviews/PersonalCaseCoverage';
import type { MessageKey } from '../../shared/i18n/messages';

export function RunArtifactViewer({
  run,
  selected,
  select,
  close,
  updateRun,
  closeLabel = 'closeReview',
}: {
  run: WorkflowRun;
  selected: string | null;
  select: (key: string) => void;
  close: () => void;
  updateRun?: UpdateRun;
  closeLabel?: MessageKey;
}) {
  const { t, locale } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const artifact = selected ? run.artifacts[selected] : undefined;
  const open = !!artifact;
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  const choices = run.plan
    .flatMap((node) => Object.keys(node.outputs).map((slot) => ({ key: `${node.id}.${slot}`, node })))
    .filter((item) => run.artifacts[item.key]);
  return (
    <dialog
      ref={ref}
      className="session-artifact-dialog"
      aria-labelledby="artifact-workspace-title"
      onCancel={close}
      onClose={close}
    >
      <header>
        <div>
          <h2 id="artifact-workspace-title">{t('artifactWorkspace')}</h2>
          <p>{t('artifactWorkspaceHint')}</p>
        </div>
        <button className="workbench-btn" onClick={close}>
          {t(closeLabel)}
        </button>
      </header>
      {artifact && (
        <>
          <div className="session-artifact-toolbar">
            <label className="wb-field">
              {t('artifactStep')}
              <select
                className="workbench-select"
                value={selected ?? ''}
                onChange={(event) => select(event.target.value)}
              >
                {choices.map(({ key, node }) => (
                  <option key={key} value={key}>
                    {nodeLabel(node, run.snapshot, t)} · {artifactLabel(run.artifacts[key], t, locale)}
                  </option>
                ))}
                {!choices.some((item) => item.key === selected) && (
                  <option value={selected ?? ''}>{artifactLabel(artifact, t, locale)}</option>
                )}
              </select>
            </label>
            <span className="wb-muted">
              {t(artifact.type.endsWith('Draft') ? 'assetDraft' : 'artifactSnapshot')}
            </span>
          </div>
          <div className="session-artifact-body">
            <ArtifactDetail key={selected} run={run} artifact={artifact} updateRun={updateRun} />
          </div>
        </>
      )}
    </dialog>
  );
}

function ArtifactDetail({
  run,
  artifact,
  updateRun,
}: {
  run: WorkflowRun;
  artifact: Artifact;
  updateRun?: UpdateRun;
}) {
  const { t } = useI18n();
  const value = artifact.value;
  if (isRequirements(value) || isDesign(value) || isCases(value))
    return <ArtifactCollection run={run} artifact={artifact} updateRun={updateRun} />;
  if (isEvidence(value)) return <EvidenceViewer evidence={value} run={run} />;
  if (isImplementation(value))
    return (
      <div className="session-artifact-reading">
        <ExecutionArtifact artifact={artifact} expandSource />
      </div>
    );
  if (isExecutionPlan(value))
    return (
      <div className="session-artifact-reading">
        <h3>{t('executionReview')}</h3>
        <dl>
          <dt>{t('targetUrl')}</dt>
          <dd>{value.payload.profile.targetUrl}</dd>
          <dt>{t('pythonVersion')}</dt>
          <dd>{value.pythonVersion}</dd>
          <dt>{t('approvedTests')}</dt>
          <dd>{value.testNames.length}</dd>
          <dt>{t('planDigest')}</dt>
          <dd>
            <code>{value.digest}</code>
          </dd>
        </dl>
        <details>
          <summary>{t('scriptSource')}</summary>
          <pre>{value.payload.implementation.script}</pre>
        </details>
      </div>
    );
  if (
    artifact.type === 'ImplementationRevision' &&
    value &&
    typeof value === 'object' &&
    'artifact' in value &&
    value.artifact &&
    typeof value.artifact === 'object' &&
    'type' in value.artifact &&
    typeof value.artifact.type === 'string' &&
    'digest' in value.artifact &&
    typeof value.artifact.digest === 'string' &&
    'value' in value.artifact &&
    isImplementation(value.artifact.value)
  )
    return (
      <div className="session-artifact-reading">
        <ExecutionArtifact artifact={value.artifact as Artifact} expandSource />
      </div>
    );
  if (
    artifact.type === 'DocumentRevision' &&
    value &&
    typeof value === 'object' &&
    'text' in value &&
    typeof value.text === 'string'
  )
    return <pre className="session-artifact-source">{value.text}</pre>;
  if (isVerdict(value))
    return (
      <div className="session-artifact-reading">
        {value.candidates.map((item) => (
          <article key={item.id}>
            <h3>{item.title}</h3>
            <p>{item.explanation}</p>
            <code>{item.testNames.join(', ')}</code>
            <p>{item.caseIds.join(', ')}</p>
          </article>
        ))}
        {value.notes.map((note, i) => (
          <p key={i}>{note}</p>
        ))}
      </div>
    );
  return (
    <div className="session-artifact-reading">
      <ArtifactPanel artifact={artifact} />
    </div>
  );
}
