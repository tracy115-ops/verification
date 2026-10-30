import { useState } from 'react';
import { coverageMatrix } from '../../domain/runtime/coverage-matrix';
import type { WorkflowRun } from '../../domain/runtime/types';
import { useI18n } from '../../shared/i18n/context';
import type { AssetView } from './AssetsWorkspace';

export function CoverageMatrix({
  run,
  navigate,
}: {
  run: WorkflowRun;
  navigate: (view: AssetView, id: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [gapsOnly, setGapsOnly] = useState(false);
  const rows = coverageMatrix(run).filter(
    (row) =>
      (!gapsOnly || row.gap) &&
      `${row.requirement.id} ${row.requirement.text}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <section className="coverage-matrix" aria-label={t('matrixTitle')}>
      <div className="coverage-matrix-toolbar">
        <input
          className="workbench-input"
          aria-label={t('assetSearch')}
          placeholder={t('assetSearch')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <label>
          <input type="checkbox" checked={gapsOnly} onChange={(event) => setGapsOnly(event.target.checked)} />{' '}
          {t('matrixGapsOnly')}
        </label>
      </div>
      <p className="wb-muted">{t('matrixHint')}</p>
      <div className="coverage-matrix-scroll">
        <table>
          <thead>
            <tr>
              {(
                [
                  'requirementItems',
                  'factorItems',
                  'scenarioItems',
                  'caseItems',
                  'matrixDeclared',
                  'matrixMapped',
                  'matrixExecution',
                ] as const
              ).map((key) => (
                <th key={key} scope="col">
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.requirement.id}>
                <td>
                  <button
                    className="workbench-btn wb-text"
                    onClick={() => navigate('requirements', row.requirement.id)}
                  >
                    {row.requirement.id} · {row.requirement.text}
                  </button>
                </td>
                {(['factors', 'scenarios', 'cases'] as const).map((kind) => (
                  <td key={kind}>
                    {row[kind].length ? (
                      <div className="coverage-matrix-links">
                        {row[kind].map((item) => (
                          <button
                            key={item.id}
                            className="workbench-btn wb-text"
                            onClick={() => navigate(kind, item.id)}
                          >
                            {item.id}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="wb-muted">{t('matrixMissing')}</span>
                    )}
                  </td>
                ))}
                <td>
                  {row.declared} / {row.cases.length}
                </td>
                <td>
                  {row.mapped} / {row.cases.length}
                </td>
                <td>
                  <span>
                    {t('matrixPassed')}: {row.passed} / {row.cases.length}
                  </span>
                  {row.failed > 0 && (
                    <p className="wb-error">
                      {t('matrixFailed')}: {row.failed}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="wb-muted">{t('assetNoMatches')}</p>}
    </section>
  );
}
