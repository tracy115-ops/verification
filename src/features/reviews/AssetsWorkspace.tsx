import { useState } from 'react';
import type { Artifact, ConversationSession, WorkflowRun } from '../../domain/runtime/types';
import { isCases, isDesign, isRequirements } from '../../domain/runtime/artifacts';
import { useI18n } from '../../shared/i18n/context';
import { ArtifactPanel } from '../sessions/ArtifactPanel';
import { FactorList } from './FactorList';
import { TraceLinks } from './TraceLinks';
import { PersonalCaseCoverage, type UpdateRun } from './PersonalCaseCoverage';
import { RunContributionExport } from './RunContributionExport';
import { personalCoverage } from '../../domain/runtime/case-coverage';
import { DesignEditActions } from './DesignEditor';

export type AssetView = 'requirements' | 'factors' | 'scenarios' | 'cases';
type View = AssetView;
export function AssetsWorkspace({
  session,
  initialView = 'requirements',
  runId,
  updateRun,
  openSession,
}: {
  session?: ConversationSession;
  initialView?: View;
  runId?: string;
  updateRun?: UpdateRun;
  openSession: () => void;
}) {
  const { t } = useI18n();
  const [view, setView] = useState<View>(initialView);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const run = session?.runs.find((item) => item.id === runId) ?? session?.runs.at(-1);
  const title = session
    ? session.title.replace(/^#+\s*/, '').split('\n')[0] || t('untitledSession')
    : t('assetsTitle');
  return (
    <div className="assets-workspace">
      <header className="assets-context">
        <div className="assets-context-title">
          <h1 title={session?.title}>{title}</h1>
          {run && run.id !== session?.runs.at(-1)?.id && <small>{t('assetHistoricalRun')}</small>}
        </div>
        <button className="workbench-btn wb-text" onClick={openSession}>
          {t('assetBackToSession')}
        </button>
        {run && <RunContributionExport run={run} />}
      </header>
      {!run ? (
        <div className="assets-empty">
          <h2>{t('assetNoTask')}</h2>
          <p>{t('assetNoTaskHint')}</p>
        </div>
      ) : (
        <>
          <nav className="assets-tabs" aria-label={t('assetsTitle')}>
            {(['requirements', 'factors', 'scenarios', 'cases'] as const).map((item) => (
              <button
                key={item}
                className="workbench-btn"
                aria-pressed={view === item}
                onClick={() => {
                  setView(item);
                  setSelected('');
                  setQuery('');
                }}
              >
                {t(
                  item === 'requirements'
                    ? 'requirementItems'
                    : item === 'factors'
                      ? 'factorItems'
                      : item === 'scenarios'
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
            navigate={(next, id) => {
              setView(next);
              setSelected(id);
              setQuery('');
            }}
          />
        </>
      )}
    </div>
  );
}

export function TaskAssets({
  run,
  view,
  query,
  setQuery,
  selected,
  setSelected,
  navigate,
  artifactOverride,
  updateRun,
}: {
  run: WorkflowRun;
  view: View;
  query: string;
  setQuery: (value: string) => void;
  selected: string;
  setSelected: (value: string) => void;
  navigate: (kind: 'requirements' | 'scenarios' | 'cases', id: string) => void;
  artifactOverride?: Artifact;
  updateRun?: UpdateRun;
}) {
  const { t } = useI18n();
  const [coverageFilter, setCoverageFilter] = useState('all');
  const all = Object.values(run.artifacts);
  const types =
    view === 'requirements'
      ? ['RequirementBaseline', 'RequirementBaselineDraft']
      : view === 'scenarios' || view === 'factors'
        ? ['TestDesign', 'TestDesignDraft']
        : ['TestCaseSet', 'TestCaseSetDraft'];
  const artifact =
    artifactOverride ??
    all.find((item) => item.type === types[0]) ??
    all.find((item) => item.type === types[1]);
  const value = artifact?.value;
  if (view === 'factors')
    return (
      <FactorList
        run={run}
        updateRun={artifactOverride ? undefined : updateRun}
        value={value}
        query={query}
        setQuery={setQuery}
        selected={selected}
        setSelected={setSelected}
        navigate={navigate}
      />
    );
  const items = isRequirements(value)
    ? value.requirements.map((item) => ({ id: item.id, title: item.text, raw: item }))
    : isDesign(value)
      ? value.scenarios.map((item) => ({ id: item.id, title: item.title, raw: item }))
      : isCases(value)
        ? value.cases.map((item) => ({ id: item.id, title: item.title, raw: item }))
        : [];
  const caseStates = new Map(
    isCases(value) ? value.cases.map((item) => [item.id, personalCoverage(run, item)]) : [],
  );
  const filtered = items.filter(
    (item) =>
      (view !== 'cases' || coverageFilter === 'all' || caseStates.get(item.id)?.status === coverageFilter) &&
      `${item.id} ${item.title} ${JSON.stringify(item.raw)}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const current = filtered.find((item) => item.id === selected) ?? filtered[0];
  const detail =
    artifact && current
      ? {
          ...artifact,
          value: isRequirements(value)
            ? { ...value, requirements: [current.raw] }
            : isDesign(value)
              ? { ...value, scenarios: [current.raw] }
              : isCases(value)
                ? { ...value, cases: [current.raw] }
                : value,
        }
      : undefined;
  return (
    <div className="assets-body">
      <div className="assets-list">
        <div className="assets-list-heading">
          <strong>
            {t('assetItems')} · {filtered.length} / {items.length}
          </strong>
          {view === 'scenarios' && isDesign(value) && !artifactOverride && (
            <DesignEditActions
              run={run}
              value={value}
              kind="scenarios"
              currentId={current?.id}
              updateRun={updateRun}
            />
          )}
          <span className="wb-muted">
            {artifact?.type.endsWith('Draft') ? t('assetDraft') : artifact ? t('assetApproved') : ''}
          </span>
        </div>
        <input
          className="workbench-input"
          aria-label={t('assetSearch')}
          placeholder={t('assetSearch')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {view === 'cases' && (
          <select
            className="workbench-select"
            aria-label={t('collab_coverage')}
            value={coverageFilter}
            onChange={(event) => setCoverageFilter(event.target.value)}
          >
            <option value="all">{t('collab_all')}</option>
            {(['uncovered', 'declared', 'mapped', 'stale'] as const).map((status) => (
              <option key={status} value={status}>
                {t(`collab_${status}`)}
              </option>
            ))}
          </select>
        )}
        {!filtered.length && (
          <p className="wb-muted">{t(artifact ? 'assetNoMatches' : 'assetNotGenerated')}</p>
        )}
        {filtered.map((item) => (
          <button
            key={item.id}
            className={`assets-item ${current?.id === item.id ? 'is-selected' : ''}`}
            onClick={() => setSelected(item.id)}
          >
            <code>{item.id}</code>
            <span>{item.title}</span>
            {caseStates.has(item.id) && (
              <small className={`collab-light is-${caseStates.get(item.id)!.status}`}>
                {t(`collab_${caseStates.get(item.id)!.status}`)}
              </small>
            )}
          </button>
        ))}
      </div>
      <div className="assets-detail">
        {detail ? (
          <>
            <ArtifactPanel artifact={detail} onNavigate={navigate} />
            <TraceLinks run={run} view={view} id={current!.id} navigate={navigate} />
            {isCases(value) && (
              <PersonalCaseCoverage
                key={current!.id}
                run={run}
                item={value.cases.find((item) => item.id === current!.id)!}
                updateRun={updateRun}
              />
            )}
          </>
        ) : (
          <p className="wb-muted">{t('assetSelectItem')}</p>
        )}
      </div>
    </div>
  );
}
