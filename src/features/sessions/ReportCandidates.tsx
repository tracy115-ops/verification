import { useState } from 'react';
import type { WorkflowRun } from '../../domain/runtime/types';
import type { VerificationReport } from '../../domain/execution/types';
import { useI18n } from '../../shared/i18n/context';
import { CandidateTrace } from './CandidateTrace';

export function ReportCandidates({ report, run }: { report: VerificationReport; run?: WorkflowRun }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState('');
  const candidate = report.candidates.find((item) => item.id === selected) ?? report.candidates[0];
  if (!candidate) return <p className="wb-muted">{t('candidateNone')}</p>;
  if (!run)
    return (
      <>
        {report.candidates.map((item) => (
          <article key={item.id}>
            <h4>{item.title}</h4>
            <p>{item.explanation}</p>
            <code>{item.testNames.join(', ')}</code>
            <p>{item.caseIds.join(', ')}</p>
          </article>
        ))}
      </>
    );
  return (
    <div className="report-candidates">
      <nav className="report-candidate-list" aria-label={t('candidateDefects')}>
        {report.candidates.map((item) => (
          <button
            type="button"
            className="workbench-btn"
            key={item.id}
            aria-pressed={candidate.id === item.id}
            onClick={() => setSelected(item.id)}
          >
            {item.title}
          </button>
        ))}
      </nav>
      <div className="report-candidate-detail">
        <h4>{candidate.title}</h4>
        <CandidateTrace key={candidate.id} run={run} report={report} candidateId={candidate.id} />
      </div>
    </div>
  );
}
