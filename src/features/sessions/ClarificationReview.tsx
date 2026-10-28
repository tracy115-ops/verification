import { useState } from 'react';
import { useI18n } from '../../shared/i18n/context';
import type { WorkflowRun } from '../../domain/runtime/types';

export function SavedClarifications({ items }: { items: NonNullable<WorkflowRun['clarifications']> }) {
  const { t } = useI18n();
  if (!items.length) return null;
  return (
    <details>
      <summary>{t('savedClarifications')}</summary>
      {items.map((item, index) => (
        <article key={index}>
          <strong>{item.question}</strong>
          <p>{item.answer}</p>
        </article>
      ))}
    </details>
  );
}

export function SavedExclusions({ items }: { items: NonNullable<WorkflowRun['reviewExclusions']> }) {
  const { t } = useI18n();
  if (!items.length) return null;
  return (
    <details>
      <summary>
        {t('savedExclusions')} · {items.length}
      </summary>
      {items.map((item, index) => (
        <article key={index}>
          <strong>{item.issue}</strong>
          <p>{item.reason}</p>
        </article>
      ))}
    </details>
  );
}

export function ClarificationReview({
  issues,
  busy,
  save,
  exclusion = false,
}: {
  issues: string[];
  busy: boolean;
  save: (answers: Record<string, string>) => void;
  exclusion?: boolean;
}) {
  const { t } = useI18n();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return (
    <section className="session-clarifications">
      <p>{t(exclusion ? 'exclusionHint' : 'clarificationHint')}</p>
      {issues.map((question, index) => (
        <label className="wb-field" key={`${index}-${question}`}>
          <span>{question}</span>
          <textarea
            className="workbench-textarea"
            maxLength={12000}
            value={answers[question] ?? ''}
            disabled={busy}
            onChange={(event) => setAnswers((current) => ({ ...current, [question]: event.target.value }))}
          />
        </label>
      ))}
      <button
        className="workbench-btn"
        disabled={busy || !Object.values(answers).some((answer) => answer.trim())}
        onClick={() => save(answers)}
      >
        {t(exclusion ? 'saveExclusions' : 'saveClarifications')}
      </button>
    </section>
  );
}
