import { useState } from 'react';
import { collaboration, scriptCoverage, type SharedCase } from '../../domain/team/collaboration';
import { useI18n } from '../../shared/i18n/context';
import type { TeamActions } from './useTeam';
import { CaseEditor } from './CaseEditor';
import { CaseDetail } from './CaseDetail';
import { ScriptImport } from './ScriptImport';

export function CaseBoard({ actions }: { actions: TeamActions }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState('');
  const [editing, setEditing] = useState<SharedCase | null | false>(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const state = collaboration(actions.project!);
  const cases = state.cases.filter(
    (item) =>
      `${item.id} ${item.title}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (filter === 'all' || ['uncovered', 'stale'].includes(scriptCoverage(actions.project!, item).status)),
  );
  const current = cases.find((item) => item.id === selected) ?? cases[0];
  const editor = ['admin', 'editor'].includes(actions.member?.role ?? '');
  return (
    <section>
      <div className="collab-toolbar">
        <input
          className="workbench-input"
          aria-label={t('collab_search')}
          placeholder={t('collab_search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="workbench-select"
          aria-label={t('collab_coverage')}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">{t('collab_all')}</option>
          <option value="open">{t('collab_open_only')}</option>
        </select>
        {editor && (
          <>
            <button className="workbench-btn" onClick={() => setEditing(null)}>
              {t('collab_new_case')}
            </button>
            <button
              className="workbench-btn wb-primary"
              disabled={!state.cases.length}
              onClick={() => setScriptOpen(true)}
            >
              {t('collab_script_import')}
            </button>
          </>
        )}
      </div>
      <p className="wb-muted">{t('collab_coverage_hint')}</p>
      <div className="collab-counters">
        {(['uncovered', 'declared', 'mapped', 'stale'] as const).map((status) => (
          <span key={status} className={`collab-light is-${status}`}>
            {t(`collab_${status}`)} ·{' '}
            {new Intl.NumberFormat(locale).format(
              state.cases.filter((item) => scriptCoverage(actions.project!, item).status === status).length,
            )}
          </span>
        ))}
      </div>
      {!state.cases.length ? (
        <p className="collab-empty">{t('collab_no_cases')}</p>
      ) : (
        <div className="collab-split">
          <div className="collab-list">
            {cases.map((item) => (
              <button
                key={item.id}
                className="collab-list-item"
                aria-pressed={item.id === current?.id}
                onClick={() => setSelected(item.id)}
              >
                <code>{item.id}</code>
                <strong>{item.title}</strong>
                <span className={`collab-light is-${scriptCoverage(actions.project!, item).status}`}>
                  {t(`collab_${scriptCoverage(actions.project!, item).status}`)}
                </span>
                <small>
                  {t('collab_execution')} · {t(`collab_${scriptCoverage(actions.project!, item).execution}`)}
                </small>
              </button>
            ))}
          </div>
          {current && (
            <CaseDetail key={current.id} actions={actions} item={current} edit={() => setEditing(current)} />
          )}
        </div>
      )}
      {editing !== false && (
        <CaseEditor actions={actions} item={editing ?? undefined} close={() => setEditing(false)} />
      )}
      {scriptOpen && <ScriptImport actions={actions} close={() => setScriptOpen(false)} />}
      {!!state.scripts.length && (
        <details className="collab-section">
          <summary>
            {t('collab_script_history')} · {state.scripts.length}
          </summary>
          {state.scripts.map((script) => (
            <p key={script.id}>
              {script.name} ·{' '}
              {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
                new Date(script.at),
              )}{' '}
              · <code>{script.sha256}</code> ·{' '}
              {actions.members.find((person) => person.id === script.by)?.name}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
