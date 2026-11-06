import { useState } from 'react';
import type { WorkflowRun } from '../../domain/runtime/types';
import type { VerificationReport } from '../../domain/execution/types';
import { candidateTrace } from '../../domain/runtime/candidate-trace';
import { useI18n } from '../../shared/i18n/context';
import { Status } from '../../shared/components/Status';
import { RequestEvidence } from './EvidenceViewer';

export function CandidateTrace({
  run,
  report,
  candidateId,
}: {
  run: WorkflowRun;
  report: VerificationReport;
  candidateId: string;
}) {
  const { t, locale } = useI18n();
  const trace = candidateTrace(run, report, candidateId);
  const [tab, setTab] = useState<'evidence' | 'cases' | 'script' | 'analysis'>('evidence');
  const [selected, setSelected] = useState('');
  if (!trace)
    return (
      <>
        <p className="wb-banner">{t('candidateEvidenceUnavailable')}</p>
        <p>{report.candidates.find((item) => item.id === candidateId)?.explanation}</p>
      </>
    );
  const current = trace.tests.find((item) => item.testName === selected) ?? trace.tests[0];
  const failureSummary = current?.result?.details
    .slice(0, 3)
    .map((text) => text.trim().split(/\r?\n/).at(-1))
    .join('\n');
  return (
    <section className="candidate-trace" aria-label={t('candidateTraceTitle')}>
      {trace.incomplete && <p className="wb-banner">{t('candidateTraceIncomplete')}</p>}
      <nav className="candidate-trace-tabs" aria-label={t('candidateTraceTitle')}>
        {(['evidence', 'cases', 'script', 'analysis'] as const).map((item) => (
          <button
            type="button"
            key={item}
            className="workbench-btn"
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
          >
            {t(
              item === 'evidence'
                ? 'candidateEvidenceTab'
                : item === 'cases'
                  ? 'candidateCasesTab'
                  : item === 'script'
                    ? 'candidateScriptTab'
                    : 'candidateAnalysisTab',
            )}
          </button>
        ))}
      </nav>
      {tab === 'evidence' && current && (
        <>
          <label className="wb-field">
            {t('candidateTestMethod')}
            <select
              className="workbench-select"
              value={current.testName}
              onChange={(event) => setSelected(event.target.value)}
            >
              {trace.tests.map((item) => (
                <option key={item.testName}>{item.testName}</option>
              ))}
            </select>
          </label>
          {current.result && (
            <Status
              tone={
                current.result.status === 'failed'
                  ? 'danger'
                  : current.result.status === 'passed'
                    ? 'success'
                    : 'warning'
              }
            >
              {t(`result_${current.result.status}`)}
            </Status>
          )}
          {!!current.result?.details.length && (
            <>
              <pre className="candidate-failure-summary">{failureSummary}</pre>
              <details>
                <summary>{t('assertionDetails')}</summary>
                <pre>{current.result.details.join('\n')}</pre>
              </details>
            </>
          )}
          <h4>
            {t('requestEvidence')} · {new Intl.NumberFormat(locale).format(current.requests.length)}
          </h4>
          {current.requests.map((request, index) => (
            <RequestEvidence key={index} value={request} />
          ))}
          {!current.requests.length && <p className="wb-muted">{t('noRequestEvidence')}</p>}
        </>
      )}
      {tab === 'cases' && (
        <>
          <h4>{t('caseItems')}</h4>
          {trace.cases.map((item) => (
            <article key={item.id}>
              <code>{item.id}</code>
              <h4>{item.title}</h4>
              {!!item.preconditions.length && (
                <>
                  <h5>{t('candidatePreconditions')}</h5>
                  <ul>
                    {item.preconditions.map((text, index) => (
                      <li key={index}>{text}</li>
                    ))}
                  </ul>
                </>
              )}
              <h5>{t('steps')}</h5>
              <ol>
                {item.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
              <h5>{t('expected')}</h5>
              <p>{item.expected}</p>
              <h5>{t('assertions')}</h5>
              <ul>
                {item.assertions.map((text, index) => (
                  <li key={index}>{text}</li>
                ))}
              </ul>
            </article>
          ))}
          <h4>{t('requirementItems')}</h4>
          {trace.requirements.map((item) => (
            <article key={item.id}>
              <code>{item.id}</code>
              <p>{item.text}</p>
              <blockquote>{item.quote}</blockquote>
            </article>
          ))}
        </>
      )}
      {tab === 'script' && (
        <>
          <p>
            {t('scriptDigest')}: <code>{trace.plan.scriptSha256}</code>
          </p>
          <pre>{trace.plan.payload.implementation.script}</pre>
        </>
      )}
      {tab === 'analysis' && (
        <>
          <p>{trace.candidate.explanation}</p>
          <p className="wb-muted">{t('candidateAnalysisHint')}</p>
        </>
      )}
    </section>
  );
}
