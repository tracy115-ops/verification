import { useState } from 'react';
import type { Artifact, WorkflowRun } from '../../domain/runtime/types';
import { isCases, isDesign, isRequirements } from '../../domain/runtime/artifacts';
import { isEvidence } from '../../domain/execution/schema';
import { useI18n } from '../../shared/i18n/context';
import { ArtifactCollection } from './ArtifactCollection';
import { EvidenceViewer } from './EvidenceViewer';
import { ExecutionArtifact } from './ExecutionArtifact';
import { artifactLabel } from './artifact-labels';

function snapshotArtifacts(value: unknown): Artifact[] {
  if (
    !value ||
    typeof value !== 'object' ||
    !('artifacts' in value) ||
    !value.artifacts ||
    typeof value.artifacts !== 'object' ||
    Array.isArray(value.artifacts)
  )
    return [];
  return Object.values(value.artifacts).filter(
    (item): item is Artifact =>
      !!item &&
      typeof item === 'object' &&
      'type' in item &&
      typeof item.type === 'string' &&
      'digest' in item &&
      typeof item.digest === 'string' &&
      'value' in item,
  );
}
export function DesignRevisionViewer({ run, artifact }: { run: WorkflowRun; artifact: Artifact }) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState(0);
  const all = snapshotArtifacts(artifact.value);
  const groups = [
    ['RequirementBaseline', 'RequirementBaselineDraft'],
    ['TestDesign', 'TestDesignDraft'],
    ['TestCaseSet', 'TestCaseSetDraft'],
    ['ImplementationBundle'],
    ['EvidenceBundle'],
    ['VerificationReport'],
  ];
  const items = groups.flatMap((types) => {
    const item = types.map((type) => all.find((value) => value.type === type)).find(Boolean);
    return item ? [item] : [];
  });
  const snapshot = { ...run, artifacts: Object.fromEntries(all.map((item, i) => [`history.${i}`, item])) };
  const current = items[selected];
  return (
    <section className="design-revision-viewer">
      <p className="wb-banner">{t('designRevisionReadonly')}</p>
      <nav className="assets-tabs" aria-label={t('designRevisionArtifacts')}>
        {items.map((item, i) => (
          <button
            className="workbench-btn"
            key={item.type}
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
          >
            {artifactLabel(item, t, locale)}
          </button>
        ))}
      </nav>
      {current &&
        (isRequirements(current.value) || isDesign(current.value) || isCases(current.value) ? (
          <ArtifactCollection run={snapshot} artifact={current} />
        ) : isEvidence(current.value) ? (
          <EvidenceViewer run={snapshot} evidence={current.value} />
        ) : (
          <div className="session-artifact-reading">
            <ExecutionArtifact artifact={current} expandSource />
          </div>
        ))}
      {!current && <p className="wb-error">{t('artifact_invalid')}</p>}
    </section>
  );
}
