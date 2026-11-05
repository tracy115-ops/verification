import type { WorkflowRun } from '../../domain/runtime/types';
import { DESIGN_ATTEMPT_BATCH_LIMIT } from '../../domain/runtime/analysis-budget';
import { latestArtifact } from '../../domain/runtime/bindings';
import { isRequirements } from '../../domain/runtime/artifacts';
import { designGroups } from '../../domain/runtime/analysis-plan';
import { useI18n } from '../../shared/i18n/context';

export function AnalysisBudgetSummary({ run }: { run: WorkflowRun }) {
  const { t, locale } = useI18n();
  const node = run.plan.find((item) => item.operation === 'scenarios.design');
  const checkpoint = node && run.steps[node.id].analysis;
  if (!checkpoint || checkpoint.kind !== 'design') return null;
  const completed = new Set(checkpoint.completed.map((item) => item.index));
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  let pending: { left: string[]; right: string[] }[] = [];
  // Display only a valid plan; imported/corrupt data must not crash the conversation.
  try {
    const baseline = latestArtifact(run, 'RequirementBaseline');
    if (isRequirements(baseline))
      pending = designGroups(baseline).filter((item, index) => item.cross && !completed.has(index));
  } catch {
    /* Existing runtime validation reports invalid plans. */
  }
  return (
    <section className="session-run-meta" aria-label={t('analysisBudgetTitle')}>
      <strong>{t('analysisBudgetTitle')}</strong>
      <p>
        {t('analysisBudgetCounts')
          .replace('{completed}', number(completed.size))
          .replace('{total}', number(checkpoint.total))}
      </p>
      <p>{t('analysisBudgetLimit').replace('{limit}', number(DESIGN_ATTEMPT_BATCH_LIMIT))}</p>
      {!!pending.length && (
        <details>
          <summary>{t('analysisPendingRelations').replace('{count}', number(pending.length))}</summary>
          <ul>
            {pending.map((item) => (
              <li key={item.left.join(',') + ':' + item.right.join(',')}>
                {item.left.join(', ')} ↔ {item.right.join(', ')}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
