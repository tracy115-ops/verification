import { useState } from 'react';
import { newId } from '../../shared/id';
import type { TeamActions } from './useTeam';
import type { TestFactor } from '../../domain/team/types';
import { factorCoverage } from '../../domain/team/rules';
import { useI18n } from '../../shared/i18n/context';
import { Status } from '../../shared/components/Status';

export function FactorList({ actions }: { actions: TeamActions }) {
  const { t, locale } = useI18n();
  const project = actions.project!;
  const [editing, setEditing] = useState<TestFactor | null>(null);
  const editable = ['admin', 'editor'].includes(actions.member?.role ?? '');
  const number = new Intl.NumberFormat(locale);
  return (
    <section className="team-factor-list">
      <h3>
        {t('team_factors')} · {number.format(project.factors.length)}
      </h3>
      <p className="wb-muted">{t('team_coverage_hint')}</p>
      {editable && (
        <button
          className="workbench-btn"
          disabled={!!editing}
          onClick={() =>
            setEditing({
              id: `F_${newId()}`,
              name: '',
              levels: [],
              basis: 'hypothesis',
              sourceQuote: '',
              rationale: '',
            })
          }
        >
          {t('team_add_factor')}
        </button>
      )}
      {editing && (
        <FactorEditor key={editing.id} actions={actions} factor={editing} close={() => setEditing(null)} />
      )}
      {project.factors.map((factor) => {
        const coverage = factorCoverage(project, factor.id);
        return (
          <article key={factor.id}>
            <strong>{factor.name}</strong>
            <div className="team-factor-meta">
              <Status tone={factor.basis === 'explicit' ? 'accent' : 'warning'}>
                {t(factor.basis === 'explicit' ? 'team_explicit' : 'team_hypothesis')}
              </Status>
              <small>
                {number.format(coverage.covered)} / {number.format(coverage.total)}
              </small>
            </div>
            <div className="team-levels">
              {factor.levels.map((level) => (
                <span key={level}>{level}</span>
              ))}
            </div>
            <p>{factor.rationale}</p>
            {factor.sourceQuote && <blockquote>{factor.sourceQuote}</blockquote>}
            {editable && (
              <button
                className="workbench-btn wb-text"
                disabled={!!editing}
                onClick={() => setEditing(factor)}
              >
                {t('team_edit_factor')}
              </button>
            )}
          </article>
        );
      })}
    </section>
  );
}
function FactorEditor({
  actions,
  factor,
  close,
}: {
  actions: TeamActions;
  factor: TestFactor;
  close: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(factor);
  const [levels, setLevels] = useState(factor.levels.join('\n'));
  const [revision] = useState(actions.project!.revision);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (
      await actions.command(
        {
          type: 'upsert_factor',
          factor: {
            ...draft,
            levels: levels
              .split(/\r?\n/)
              .map((value) => value.trim())
              .filter(Boolean),
          },
        },
        revision,
      )
    )
      close();
  }
  return (
    <form className="team-factor-form" onSubmit={(event) => void save(event)}>
      {revision !== actions.project!.revision && <p className="wb-banner">{t('team_conflict_draft')}</p>}
      <label className="wb-field">
        {t('team_factor_name')}
        <input
          className="workbench-input"
          value={draft.name}
          required
          maxLength={12000}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>
      <label className="wb-field">
        {t('team_factor_levels')}
        <textarea
          className="workbench-textarea"
          value={levels}
          required
          maxLength={12000}
          onChange={(event) => setLevels(event.target.value)}
        />
      </label>
      <label className="wb-field">
        {t('team_factor_basis')}
        <select
          className="workbench-select"
          value={draft.basis}
          onChange={(event) => setDraft({ ...draft, basis: event.target.value as TestFactor['basis'] })}
        >
          <option value="hypothesis">{t('team_hypothesis')}</option>
          <option value="explicit">{t('team_explicit')}</option>
        </select>
      </label>
      <label className="wb-field">
        {t('sourceQuote')}
        <textarea
          className="workbench-textarea"
          maxLength={12000}
          value={draft.sourceQuote}
          onChange={(event) => setDraft({ ...draft, sourceQuote: event.target.value })}
        />
      </label>
      <label className="wb-field">
        {t('team_factor_rationale')}
        <textarea
          className="workbench-textarea"
          maxLength={12000}
          required
          value={draft.rationale}
          onChange={(event) => setDraft({ ...draft, rationale: event.target.value })}
        />
      </label>
      <p className="wb-muted">{t('team_factor_edit_hint')}</p>
      <div className="team-actions">
        <button className="workbench-btn" type="button" onClick={close}>
          {t('team_close')}
        </button>
        <button className="workbench-btn wb-primary" disabled={actions.busy} type="submit">
          {t('team_save_factor')}
        </button>
      </div>
    </form>
  );
}
