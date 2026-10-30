import { canonical } from '../../domain/team/collaboration';
import { useI18n } from '../../shared/i18n/context';

function fields(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function changedFields(before: unknown, after: unknown) {
  const previous = fields(before),
    next = fields(after);
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])]
    .filter(
      (key) =>
        Object.hasOwn(previous, key) !== Object.hasOwn(next, key) ||
        canonical(previous[key]) !== canonical(next[key]),
    )
    .map((key) => ({ key, before: previous[key], after: next[key] }));
}
export function FieldChanges({ before, after }: { before: unknown; after: unknown }) {
  const { t } = useI18n();
  const labels = {
    title: 'diffTitle',
    name: 'diffTitle',
    scenarioIds: 'diffScenarios',
    requirementIds: 'diffRequirements',
    preconditions: 'diffPreconditions',
    steps: 'diffSteps',
    expected: 'diffExpected',
    assertions: 'diffAssertions',
    ownerId: 'diffOwner',
    levels: 'diffLevels',
    sourceQuote: 'diffQuote',
    oracle: 'diffOracle',
  } as const;
  const changes = changedFields(before, after);
  const display = (value: unknown) =>
    value === undefined || value === null
      ? t('diffEmpty')
      : typeof value === 'string'
        ? value
        : Array.isArray(value) && value.every((item) => typeof item === 'string')
          ? value.join('\n')
          : JSON.stringify(value, null, 2);
  return (
    <section className="field-changes" aria-label={t('diffFields')}>
      <h4>
        {t('diffFields')} · {changes.length}
      </h4>
      {changes.length ? (
        <div className="field-changes-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('diffField')}</th>
                <th scope="col">{t('collab_before')}</th>
                <th scope="col">{t('collab_after')}</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.key}>
                  <th scope="row">
                    {change.key in labels ? (
                      t(labels[change.key as keyof typeof labels])
                    ) : (
                      <code>{change.key}</code>
                    )}
                  </th>
                  <td>
                    <pre>{display(change.before)}</pre>
                  </td>
                  <td>
                    <pre>{display(change.after)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>{t('diffUnchanged')}</p>
      )}
      <details>
        <summary>{t('diffRaw')}</summary>
        <pre>{JSON.stringify({ before, after }, null, 2)}</pre>
      </details>
    </section>
  );
}
