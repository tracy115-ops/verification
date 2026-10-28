import { useState } from 'react';
import type { ConversationSession, WorkflowRun } from '../../domain/runtime/types';
import { isCases, isDesign, isRequirements } from '../../domain/runtime/artifacts';
import { useI18n } from '../../shared/i18n/context';
import { ArtifactPanel } from '../sessions/ArtifactPanel';
import { FactorList } from './FactorList';
import { TraceLinks } from './TraceLinks';

type View = 'requirements' | 'factors' | 'scenarios' | 'cases';
export function AssetsWorkspace({
  sessions,
  initialView = 'requirements',
  initialRunId,
}: {
  sessions: ConversationSession[];
  initialView?: View;
  initialRunId?: string;
}) {
  const { t, locale } = useI18n();
  const records = sessions.flatMap((session) => session.runs.map((run) => ({ session, run })));
  const [runId, setRunId] = useState(
    records.some((item) => item.run.id === initialRunId) ? initialRunId! : (records.at(-1)?.run.id ?? ''),
  );
  const [view, setView] = useState<View>(initialView);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const run = records.find((item) => item.run.id === runId)?.run;
  return (
    <div className="assets-workspace">
      <div className="assets-toolbar">
        <label className="wb-field">
          {t('assetTask')}
          <select
            className="workbench-select"
            value={run?.id ?? ''}
            onChange={(event) => {
              setRunId(event.target.value);
              setSelected('');
              setQuery('');
            }}
          >
            <option value="">{t('assetChooseTask')}</option>
            {records.map(({ session, run }) => (
              <option key={run.id} value={run.id}>
                {session.title || t('untitledSession')} ·{' '}
                {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
                  new Date(run.createdAt),
                )}{' '}
                · {run.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <p className="wb-muted">{t('assetScopeHint')}</p>
      </div>
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

function TaskAssets({
  run,
  view,
  query,
  setQuery,
  selected,
  setSelected,
  navigate,
}: {
  run: WorkflowRun;
  view: View;
  query: string;
  setQuery: (value: string) => void;
  selected: string;
  setSelected: (value: string) => void;
  navigate: (kind: 'requirements' | 'scenarios' | 'cases', id: string) => void;
}) {
  const { t } = useI18n();
  const all = Object.values(run.artifacts);
  const types =
    view === 'requirements'
      ? ['RequirementBaseline', 'RequirementBaselineDraft']
      : view === 'scenarios' || view === 'factors'
        ? ['TestDesign', 'TestDesignDraft']
        : ['TestCaseSet', 'TestCaseSetDraft'];
  const artifact = all.find((item) => item.type === types[0]) ?? all.find((item) => item.type === types[1]);
  const value = artifact?.value;
  if (view === 'factors')
    return (
      <FactorList
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
  const filtered = items.filter((item) =>
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
          </button>
        ))}
      </div>
      <div className="assets-detail">
        {detail ? (
          <>
            <ArtifactPanel artifact={detail} onNavigate={navigate} />
            <TraceLinks run={run} view={view} id={current!.id} navigate={navigate} />
          </>
        ) : (
          <p className="wb-muted">{t('assetSelectItem')}</p>
        )}
      </div>
    </div>
  );
}
