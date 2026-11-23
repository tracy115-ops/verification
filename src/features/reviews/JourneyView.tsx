import type { ScenarioJourney } from '../../domain/runtime/types';
import { useI18n } from '../../shared/i18n/context';

export function JourneyView({ journey }: { journey?: ScenarioJourney }) {
  const { t } = useI18n();
  if (!journey) return null;
  return (
    <section className="journey-view" aria-label={t('journeyTitle')}>
      <h4>{t('journeyTitle')}</h4>
      <p className="wb-muted">{t('journeyReviewHint')}</p>
      <p>
        <small>{t('journeyInitialState')} · </small>
        {journey.initialState}
      </p>
      {!!journey.preconditions.length && (
        <ul>
          {journey.preconditions.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
      <ol>
        {journey.steps.map((step) => (
          <li key={step.id}>
            <header>
              <code>{step.id}</code>
              <span>
                {step.fromState} → {step.toState}
              </span>
            </header>
            <p>
              <strong>{t('journeyAction')} · </strong>
              {step.action}
            </p>
            <p>
              <strong>{t('journeyObservation')} · </strong>
              {step.observation}
            </p>
            <details>
              <summary>
                {t('journeyRule')} · {step.requirementId}
              </summary>
              <blockquote>{step.sourceQuote}</blockquote>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
