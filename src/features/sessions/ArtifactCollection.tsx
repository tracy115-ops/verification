import { useState } from 'react';
import type { Artifact, WorkflowRun } from '../../domain/runtime/types';
import { isCases, isDesign } from '../../domain/runtime/artifacts';
import { TaskAssets, type AssetView } from '../reviews/AssetsWorkspace';
import { useI18n } from '../../shared/i18n/context';
import type { UpdateRun } from '../reviews/PersonalCaseCoverage';
import { RunContributionExport } from '../reviews/RunContributionExport';

export function ArtifactCollection({
  run,
  artifact,
  updateRun,
}: {
  run: WorkflowRun;
  artifact: Artifact;
  updateRun?: UpdateRun;
}) {
  const { t } = useI18n();
  const initial: AssetView = isCases(artifact.value)
    ? 'cases'
    : isDesign(artifact.value)
      ? 'scenarios'
      : 'requirements';
  const [view, setView] = useState<AssetView>(initial);
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const override = view === initial || (initial === 'scenarios' && view === 'factors') ? artifact : undefined;
  return (
    <div className="session-artifact-collection">
      <RunContributionExport run={run} />
      <nav className="assets-tabs" aria-label={t('artifactViews')}>
        {(['requirements', 'factors', 'scenarios', 'cases'] as const).map((kind) => (
          <button
            className="workbench-btn"
            key={kind}
            aria-pressed={view === kind}
            onClick={() => {
              setView(kind);
              setQuery('');
              setSelected('');
            }}
          >
            {t(
              kind === 'requirements'
                ? 'requirementItems'
                : kind === 'factors'
                  ? 'factorItems'
                  : kind === 'scenarios'
                    ? 'scenarioItems'
                    : 'caseItems',
            )}
          </button>
        ))}
      </nav>
      <TaskAssets
        updateRun={updateRun}
        run={run}
        view={view}
        query={query}
        setQuery={setQuery}
        selected={selected}
        setSelected={setSelected}
        artifactOverride={override}
        navigate={(kind, id) => {
          setView(kind);
          setSelected(id);
          setQuery('');
        }}
      />
    </div>
  );
}
