import type { Artifact } from '../../domain/runtime/types';
import { isCases, isDesign, isRequirements } from '../../domain/runtime/artifacts';
import { useI18n } from '../../shared/i18n/context';
import { ExecutionArtifact } from './ExecutionArtifact';

export function ArtifactPanel({
  artifact,
  onNavigate,
}: {
  artifact: Artifact;
  onNavigate?: (kind: 'requirements' | 'scenarios', id: string) => void;
}) {
  const { t } = useI18n();
  const value = artifact.value;
  return (
    <section className="session-artifact">
      <ExecutionArtifact artifact={artifact} />
      {isRequirements(value) && (
        <>
          <h3>{t('requirementItems')}</h3>
          {value.requirements.map((item) => (
            <article key={item.id}>
              <code>{item.id}</code>
              <h4>{item.text}</h4>
              <blockquote>{item.quote.length > 400 ? `${item.quote.slice(0, 400)}…` : item.quote}</blockquote>
              {item.quote.length > 400 && (
                <details>
                  <summary>{t('viewFullQuote')}</summary>
                  <blockquote>{item.quote}</blockquote>
                </details>
              )}
              <small>{t('acceptanceCriteria')}</small>
              <ul>
                {item.acceptanceCriteria.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </article>
          ))}
        </>
      )}
      {isDesign(value) && (
        <>
          <h3>{t('scenarioItems')}</h3>
          <p>{value.strategy}</p>
          {value.scenarios.map((item) => (
            <article key={item.id}>
              <code>{item.id}</code>
              <h4>{item.title}</h4>
              <p>
                <small>{t('relatedRequirements')}: </small>
                {onNavigate
                  ? item.requirementIds.map((id) => (
                      <button
                        key={id}
                        className="workbench-btn wb-text"
                        onClick={() => onNavigate('requirements', id)}
                      >
                        {id}
                      </button>
                    ))
                  : item.requirementIds.join(', ')}
              </p>
              <p>
                <small>{t('coverageDimension')}: </small>
                {item.dimension}
              </p>
              {!!item.factorLevels?.length && (
                <p>
                  <small>{t('factorItems')}: </small>
                  {item.factorLevels.map((factor) => `${factor.factorId}: ${factor.level}`).join(' · ')}
                </p>
              )}
              <p>{item.expected}</p>
            </article>
          ))}
        </>
      )}
      {isCases(value) && (
        <>
          <h3>{t('caseItems')}</h3>
          {value.cases.map((item) => (
            <article key={item.id}>
              <code>{item.id}</code>
              <h4>{item.title}</h4>
              <p>
                <small>{t('relatedScenarios')}: </small>
                {onNavigate
                  ? item.scenarioIds.map((id) => (
                      <button
                        key={id}
                        className="workbench-btn wb-text"
                        onClick={() => onNavigate('scenarios', id)}
                      >
                        {id}
                      </button>
                    ))
                  : item.scenarioIds.join(', ')}
              </p>
              <p>
                <small>{t('relatedRequirements')}: </small>
                {onNavigate
                  ? item.requirementIds.map((id) => (
                      <button
                        key={id}
                        className="workbench-btn wb-text"
                        onClick={() => onNavigate('requirements', id)}
                      >
                        {id}
                      </button>
                    ))
                  : item.requirementIds.join(', ')}
              </p>
              {!!item.preconditions.length && (
                <>
                  <small>{t('casePreconditions')}</small>
                  <ul>
                    {item.preconditions.map((text, i) => (
                      <li key={i}>{text}</li>
                    ))}
                  </ul>
                </>
              )}
              <small>{t('caseSteps')}</small>
              <ol>
                {item.steps.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ol>
              <small>{t('caseExpected')}</small>
              <p>{item.expected}</p>
              <small>{t('assertions')}</small>
              <ul>
                {item.assertions.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </article>
          ))}
        </>
      )}
      <details>
        <summary>{t('artifactJson')}</summary>
        <pre>{JSON.stringify(value, null, 2)}</pre>
      </details>
    </section>
  );
}
