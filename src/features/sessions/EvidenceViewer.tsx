import { useState } from 'react';
import type { EvidenceBundle } from '../../domain/execution/types';
import type { WorkflowRun } from '../../domain/runtime/types';
import { isImplementation } from '../../domain/execution/schema';
import { useI18n } from '../../shared/i18n/context';
import { Status } from '../../shared/components/Status';

export function EvidenceViewer({ evidence, run }: { evidence: EvidenceBundle; run: WorkflowRun }) {
  const { t } = useI18n();
  const [failedOnly, setFailedOnly] = useState(evidence.results.some((item) => item.status === 'failed'));
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const results = evidence.results.filter(
    (item) =>
      (!failedOnly || item.status === 'failed') &&
      item.testName.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const current = results.find((item) => item.testName === selected) ?? results[0];
  const implementation = Object.values(run.artifacts).find((item) => isImplementation(item.value))?.value;
  const mapped = isImplementation(implementation)
    ? implementation.tests.find((item) => item.testName === current?.testName)?.caseIds
    : [];
  const requests = evidence.requests.filter(
    (item) =>
      item &&
      typeof item === 'object' &&
      'test' in item &&
      typeof item.test === 'string' &&
      (item.test === current?.testName || item.test.endsWith(`.${current?.testName}`)),
  );
  return (
    <div className="assets-body">
      <div className="assets-list">
        <label className="session-evidence-filter">
          <input
            type="checkbox"
            checked={failedOnly}
            onChange={(event) => setFailedOnly(event.target.checked)}
          />
          {t('showFailedOnly')}
        </label>
        <input
          className="workbench-input"
          aria-label={t('searchTestMethods')}
          placeholder={t('searchTestMethods')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {results.map((item) => (
          <button
            className={`assets-item ${current === item ? 'is-selected' : ''}`}
            key={item.testName}
            onClick={() => setSelected(item.testName)}
          >
            <span>{item.testName}</span>
            <Status
              tone={item.status === 'failed' ? 'danger' : item.status === 'passed' ? 'success' : 'warning'}
            >
              {t(`result_${item.status}`)}
            </Status>
          </button>
        ))}
      </div>
      <div className="assets-detail">
        {current ? (
          <section className="session-artifact">
            <h3>{current.testName}</h3>
            <p>
              {t('caseItems')}: {mapped?.join(', ')}
            </p>
            <Status
              tone={
                current.status === 'failed' ? 'danger' : current.status === 'passed' ? 'success' : 'warning'
              }
            >
              {t(`result_${current.status}`)}
            </Status>
            {!!current.details.length && (
              <details>
                <summary>{t('assertionDetails')}</summary>
                <pre>{current.details.join('\n')}</pre>
              </details>
            )}
            <h4>
              {t('requestEvidence')} · {requests.length}
            </h4>
            {requests.map((item, index) => (
              <RequestEvidence key={index} value={item} />
            ))}
            {!requests.length && <p>{t('noRequestEvidence')}</p>}
          </section>
        ) : (
          <p>{t('assetNoMatches')}</p>
        )}
      </div>
    </div>
  );
}

function RequestEvidence({ value }: { value: unknown }) {
  const { t } = useI18n();
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const request =
    record.request && typeof record.request === 'object' ? (record.request as Record<string, unknown>) : {};
  const response =
    record.response && typeof record.response === 'object'
      ? (record.response as Record<string, unknown>)
      : {};
  return (
    <article className="session-request-evidence">
      <strong>
        {typeof request.method === 'string' ? request.method : ''}{' '}
        {typeof request.path === 'string' ? request.path : ''}
      </strong>
      <span>{typeof response.status === 'number' ? response.status : ''}</span>
      <details>
        <summary>{t('requestResponseDetails')}</summary>
        <pre>{JSON.stringify(value, null, 2)}</pre>
      </details>
    </article>
  );
}
