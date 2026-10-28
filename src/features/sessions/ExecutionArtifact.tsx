import type { Artifact } from '../../domain/runtime/types';
import { isEvidence, isImplementation, isReport } from '../../domain/execution/schema';
import { useI18n } from '../../shared/i18n/context';
import { Status } from '../../shared/components/Status';

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ExecutionArtifact({ artifact }: { artifact: Artifact }) {
  const { t, locale } = useI18n();
  const value = artifact.value;
  return (
    <>
      {isImplementation(value) && (
        <>
          <h3>{t('scriptSource')}</h3>
          <button
            className="workbench-btn"
            onClick={() => download('test_generated.py', value.script, 'text/x-python;charset=utf-8')}
          >
            {t('downloadScript')}
          </button>
          <details>
            <summary>{t('scriptSource')}</summary>
            <pre>{value.script}</pre>
          </details>
          <ul>
            {value.questions.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {isEvidence(value) && (
        <>
          <h3>{t('executionResults')}</h3>
          {value.results.map((item) => (
            <article key={item.testName}>
              <code>{item.testName}</code>
              <Status
                tone={item.status === 'passed' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'}
              >
                {t(`result_${item.status}`)}
              </Status>
              {!!item.details.length && (
                <details>
                  <summary>{t('artifactJson')}</summary>
                  <pre>{item.details.join('\n')}</pre>
                </details>
              )}
            </article>
          ))}
          <p>
            {t('rawEvidenceDigest')}: <code>{value.rawEvidenceSha256}</code>
          </p>
          <details>
            <summary>{t('requestEvidence')}</summary>
            <pre>{JSON.stringify(value.requests, null, 2)}</pre>
          </details>
        </>
      )}
      {isReport(value) && (
        <>
          <h3>{t(`execution_${value.status}`)}</h3>
          <div className="session-result-counts">
            {Object.entries(value.counts).map(([key, count]) => (
              <span key={key}>
                {t(`result_${key}` as 'result_passed')}: {new Intl.NumberFormat(locale).format(count)}
              </span>
            ))}
          </div>
          <h4>{t('candidateDefects')}</h4>
          {!!value.reviewExclusions?.length && (
            <details>
              <summary>
                {t('savedExclusions')} · {value.reviewExclusions.length}
              </summary>
              {value.reviewExclusions.map((item, index) => (
                <article key={index}>
                  <strong>{item.issue}</strong>
                  <p>{item.reason}</p>
                </article>
              ))}
            </details>
          )}
          {value.candidates.map((item) => (
            <article key={item.id}>
              <h4>{item.title}</h4>
              <p>{item.explanation}</p>
              <code>{item.testNames.join(', ')}</code>
              <p>{item.caseIds.join(', ')}</p>
            </article>
          ))}
          <p>{t(`action_${value.action}`)}</p>
          <p className="wb-muted">{t('reportOnly')}</p>
          <button
            className="workbench-btn"
            onClick={() =>
              download('verification-report.json', JSON.stringify(value, null, 2), 'application/json')
            }
          >
            {t('downloadReport')}
          </button>
        </>
      )}
    </>
  );
}
