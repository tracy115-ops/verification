import { useState } from 'react';
import type { CaseArtifact, WorkflowRun } from '../../domain/runtime/types';
import { coverageEvents, personalCoverage } from '../../domain/runtime/case-coverage';
import { canonical } from '../../domain/team/collaboration';
import { digest } from '../../domain/runtime/plan';
import { useI18n } from '../../shared/i18n/context';

export type UpdateRun = (sessionId: string, run: WorkflowRun) => void;
export function PersonalCaseCoverage({
  run,
  item,
  updateRun,
}: {
  run: WorkflowRun;
  item: CaseArtifact['cases'][number];
  updateRun?: UpdateRun;
}) {
  const { t, locale } = useI18n();
  const coverage = personalCoverage(run, item);
  const [checked, setChecked] = useState(!!coverage.current && !!coverage.claim?.covered);
  const [note, setNote] = useState(coverage.claim?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function save() {
    if (!updateRun) return;
    setBusy(true);
    setError(false);
    try {
      const previous = coverageEvents(run);
      if (previous.length >= 1000) throw new Error();
      const value = {
        version: 1,
        events: [
          ...previous,
          {
            caseId: item.id,
            baseline: canonical(item),
            covered: checked,
            note,
            at: new Date().toISOString(),
          },
        ],
      };
      updateRun(run.sessionId, {
        ...run,
        artifacts: {
          ...run.artifacts,
          'coverage.declarations': { type: 'CaseCoverageDeclarations', value, digest: await digest(value) },
        },
      });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="collab-section personal-case-coverage">
      <h3>{t('collab_coverage')}</h3>
      <p className={`collab-light is-${coverage.status}`}>{t(`collab_${coverage.status}`)}</p>
      <p>
        {t('collab_execution')} · {t(`collab_local_${coverage.execution}`)}
      </p>
      {!!coverage.tests.length && (
        <p>
          <code>{coverage.tests.map((test) => test.testName).join(', ')}</code>
        </p>
      )}
      <p className="wb-muted">{t('collab_coverage_hint')}</p>
      {updateRun && (
        <>
          <label className="collab-check">
            <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
            {t('collab_declare')}
          </label>
          <label className="wb-field">
            {t('collab_reference')}
            <textarea
              aria-label={t('collab_reference')}
              className="workbench-textarea"
              maxLength={12000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <button
            className="workbench-btn"
            disabled={busy || (checked && !note.trim())}
            onClick={() => void save()}
          >
            {t('collab_save_declaration')}
          </button>
        </>
      )}
      {error && <p className="wb-error">{t('session_storage_full')}</p>}
      {coverage.claim && (
        <p className="wb-muted">
          {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
            new Date(coverage.claim.at),
          )}{' '}
          · {coverage.claim.note}
        </p>
      )}
    </section>
  );
}
